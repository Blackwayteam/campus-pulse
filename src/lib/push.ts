import { getToken } from 'firebase/messaging'
import { getFirebaseMessaging } from './firebase'
import { supabase } from './supabase'

export async function enablePushNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return { success: false, error: 'Not supported on this device' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' }
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

    const messaging = await getFirebaseMessaging()
    if (!messaging) {
      return { success: false, error: 'Messaging not supported on this browser' }
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      return { success: false, error: 'Could not get push token' }
    }

    const deviceType = /android/i.test(navigator.userAgent)
      ? 'android'
      : /iphone|ipad/i.test(navigator.userAgent)
      ? 'ios'
      : 'web'

    await supabase.from('fcm_tokens').upsert(
      {
        user_id: userId,
        token,
        device_type: deviceType,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'token' }
    )

    return { success: true }
  } catch (e: any) {
    console.error('Push enable error:', e)
    return { success: false, error: e.message }
  }
}

export async function getNotificationPermissionStatus(): Promise<string> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}