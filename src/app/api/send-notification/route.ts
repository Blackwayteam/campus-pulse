import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

export const runtime = 'nodejs'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
  )
  return initializeApp({ credential: cert(serviceAccount) })
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function buildNotification(
  status: string,
  code: string,
  building: string,
  message?: string | null
): { title: string; body: string } {
  if (status === 'cancelled') {
    return {
      title: 'FIRE: ' + code + ' IS CANCELLED',
      body: building + ' is burning. Class is cancelled. Run.',
    }
  }
  if (status === 'confirmed') {
    return {
      title: code + ' IS ON',
      body: 'Rain on ' + building + '. Class confirmed. Move!',
    }
  }
  if (status === 'pending') {
    return {
      title: code + ' - STAY TUNED',
      body: 'Something is happening at ' + building + '. Hold tight.',
    }
  }
  if (status === 'delayed') {
    return {
      title: code + ' DELAYED',
      body: 'Running late at ' + building + '. Stay close.',
    }
  }
  if (status === 'warning') {
    return {
      title: 'URGENT - ' + building,
      body: message || 'Urgent alert from your campus.',
    }
  }
  // broadcast or fallback
  return {
    title: 'Campus Broadcast',
    body: message || 'New broadcast from your campus.',
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { school_id, target_type, target_id, status, message } = body

    if (!school_id || !target_type || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = supabaseAdmin()

    let classCode = 'Campus'
    let buildingName = 'your campus'

    if (target_type === 'class') {
      const { data: cls } = await db
        .from('classes')
        .select('code, room_id')
        .eq('id', target_id)
        .single()

      if (cls) {
        classCode = cls.code
        if (cls.room_id) {
          const { data: room } = await db
            .from('rooms')
            .select('building_id')
            .eq('id', cls.room_id)
            .single()
          if (room?.building_id) {
            const { data: building } = await db
              .from('buildings')
              .select('name')
              .eq('id', room.building_id)
              .single()
            if (building) buildingName = building.name
          }
        }
      }
    }

    let userIds: string[] = []

    if (target_type === 'class') {
      const { data: enrollments } = await db
        .from('class_enrollments')
        .select('user_id')
        .eq('class_id', target_id)
      userIds = (enrollments ?? []).map((e) => e.user_id)
    } else if (target_type === 'school') {
      const { data: users } = await db.from('users').select('id').eq('school_id', school_id)
      userIds = (users ?? []).map((u) => u.id)
    } else if (target_type === 'building') {
      const { data: rooms } = await db.from('rooms').select('id').eq('building_id', target_id)
      const roomIds = (rooms ?? []).map((r) => r.id)
      if (roomIds.length > 0) {
        const { data: classes } = await db.from('classes').select('id').in('room_id', roomIds)
        const classIds = (classes ?? []).map((c) => c.id)
        if (classIds.length > 0) {
          const { data: enrollments } = await db
            .from('class_enrollments')
            .select('user_id')
            .in('class_id', classIds)
          userIds = (enrollments ?? []).map((e) => e.user_id)
        }
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'No enrolled users found' })
    }

    const { data: tokenRows } = await db.from('fcm_tokens').select('token').in('user_id', userIds)
    const tokens = [...new Set((tokenRows ?? []).map((t) => t.token))]

    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'No registered devices found' })
    }

    const { title, body: notifBody } = buildNotification(status, classCode, buildingName, message)

    getAdminApp()
    const messaging = getMessaging()

    const chunks: string[][] = []
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500))

    let successCount = 0
    let failureCount = 0
    const invalidTokens: string[] = []

    for (const chunk of chunks) {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body: notifBody },
        webpush: {
          notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
          fcmOptions: { link: '/campus' },
        },
      })

      successCount += response.successCount
      failureCount += response.failureCount

      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(chunk[idx])
          }
        }
      })
    }

    if (invalidTokens.length > 0) {
      await db.from('fcm_tokens').delete().in('token', invalidTokens)
    }

    return NextResponse.json({ sent: successCount, failed: failureCount })
  } catch (e: any) {
    console.error('Push notification error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}