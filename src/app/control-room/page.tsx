'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { playSound } from '@/lib/sounds'
import { AnnouncementStatus } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

interface AssignedClass {
  class_id: string
  class_code: string
  class_name: string
  level: string | null
  department_name: string | null
  building_name: string | null
  building_id: string | null
  building_status: string | null
  room_name: string | null
  last_status: AnnouncementStatus | null
  last_posted_at: string | null
  reliability_score: number | null
  total_announcements: number | null
  current_streak: number | null
}

interface FeedItem {
  id: string
  school_id: string
  status: AnnouncementStatus
  message: string | null
  target_type: string
  target_id: string
  created_by: string
  created_at: string
  voice_url: string | null
  voice_expired: boolean
}

interface ClassInfo {
  id: string
  code: string
  name: string
}

const STATUS_CONFIG: Partial<Record<AnnouncementStatus, {
  label: string
  emoji: string
  color: string
  btn: string
  sound: string
}>> = {
  pending: {
    label: 'STAY TUNED',
    emoji: '⚠️',
    color: 'border-orange-500 bg-orange-500/10 text-orange-400',
    btn: 'bg-orange-500 hover:bg-orange-400',
    sound: '🔈',
  },
  cancelled: {
    label: 'BURN IT',
    emoji: '🔥',
    color: 'border-red-500 bg-red-500/10 text-red-400',
    btn: 'bg-red-500 hover:bg-red-400',
    sound: '🔊',
  },
  confirmed: {
    label: 'CONFIRM',
    emoji: '✅',
    color: 'border-blue-500 bg-blue-500/10 text-blue-400',
    btn: 'bg-blue-500 hover:bg-blue-400',
    sound: '🌧️',
  },
  delayed: {
    label: 'DELAY',
    emoji: '⏱️',
    color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
    btn: 'bg-yellow-500 hover:bg-yellow-400',
    sound: '⚡',
  },
}

const statusEmoji: Record<string, string> = {
  normal: '🟢',
  pending: '⚠️',
  cancelled: '🔥',
  confirmed: '✅',
  delayed: '⏱️',
  warning: '🚨',
  broadcast: '📣',
}

const statusBorder: Record<string, string> = {
  cancelled: 'border-red-500',
  confirmed: 'border-blue-500',
  delayed: 'border-yellow-500',
  pending: 'border-orange-500',
  broadcast: 'border-purple-500',
  warning: 'border-red-600',
}

export default function ControlRoomPage() {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const [classes, setClasses] = useState<AssignedClass[]>([])
  const [classMap, setClassMap] = useState<Record<string, ClassInfo>>({})
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [selectedClass, setSelectedClass] = useState<AssignedClass | null>(null)
  const [activeStatus, setActiveStatus] = useState<AnnouncementStatus | null>(null)
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [postError, setPostError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [view, setView] = useState<'classes' | 'tv'>('classes')
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    const role = user.role?.role_type
    if (role !== 'course_rep' && role !== 'super_admin') {
      router.push('/campus')
    }
  }, [user, loading])

  useEffect(() => {
    if (!user?.school?.id) return

    loadClasses()
    loadFeed()

    // Clean up old channel before creating new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    channelRef.current = supabase
      .channel(`control-room:${user.school.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `school_id=eq.${user.school.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status
          if (newStatus) playSound(newStatus)
          loadFeed()
          loadClasses()
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [user?.school?.id])

  async function loadClasses() {
    setDataLoading(true)
    const { data } = await supabase
      .from('rep_dashboard')
      .select('*')
      .eq('user_id', user?.id)

    setClasses(data ?? [])
    if (data && data.length > 0 && !selectedClass) {
      setSelectedClass(data[0])
    }
    setDataLoading(false)
  }

  async function loadFeed() {
    // Query announcements table directly — bypasses view RLS issues
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', user?.school?.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Feed error:', error)
      return
    }

    const items = data ?? []
    setFeed(items)

    // Load class names for class-type announcements
    const classIds = [...new Set(
      items
        .filter(a => a.target_type === 'class')
        .map(a => a.target_id)
    )]

    if (classIds.length > 0) {
      const { data: classData } = await supabase
        .from('classes')
        .select('id, code, name')
        .in('id', classIds)

      const map: Record<string, ClassInfo> = {}
      classData?.forEach(c => { map[c.id] = c })
      setClassMap(map)
    }
  }

  async function postAnnouncement() {
    if (!selectedClass || !activeStatus) return
    setPosting(true)
    setPostError('')

    // Play sound IMMEDIATELY on button press — don't wait for DB
    playSound(activeStatus)

    const { error } = await supabase.from('announcements').insert({
      school_id: user?.school?.id,
      created_by: user?.id,
      creator_role: (user?.role?.role_type ?? 'super_admin') as any,
      target_type: 'class',
      target_id: selectedClass.class_id,
      status: activeStatus,
      message: message || null,
    })

    if (!error) {
      fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: user?.school?.id,
          target_type: 'class',
          target_id: selectedClass.class_id,
          status: activeStatus,
          message: message || null,
        }),
      }).catch((e) => console.warn('Push notification failed:', e))

      setPosted(true)
      setMessage('')
      setActiveStatus(null)
      setTimeout(() => setPosted(false), 3000)
      loadFeed()
      loadClasses()
    } else {
      // Show the ACTUAL error so we can see what's happening
      setPostError(error.message)
      console.error('Full error:', JSON.stringify(error))
    }

    setPosting(false)
  }
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎮</div>
          <p className="text-orange-500 font-bold animate-pulse">Loading Control Room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎮</span>
              <h1 className="text-base font-black tracking-widest uppercase text-orange-400">
                Control Room
              </h1>
            </div>
            <p className="text-zinc-600 text-xs mt-0.5">
              {user?.role?.hero_title ?? user?.profile?.full_name} · Course Rep
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-right">
            <p className="text-orange-400 text-lg font-black">
              {classes[0]?.reliability_score?.toFixed(0) ?? '0'}
              <span className="text-xs text-zinc-500 font-normal">pts</span>
            </p>
            <p className="text-zinc-500 text-xs">
              🔥 {classes[0]?.current_streak ?? 0} streak
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setView('classes')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              view === 'classes' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            🎯 My Classes
          </button>
          <button
            onClick={() => setView('tv')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              view === 'tv' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            📺 Campus TV {feed.length > 0 && `(${feed.length})`}
          </button>
        </div>
      </div>

      {/* CLASSES VIEW */}
      {view === 'classes' && (
        <div className="flex-1 overflow-y-auto">
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-zinc-400 font-bold">No classes assigned yet</p>
              <p className="text-zinc-600 text-sm mt-2">
                Ask your school admin to assign you to a class
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">

              {/* Class selector */}
              {classes.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {classes.map((cls) => (
                    <button
                      key={cls.class_id}
                      onClick={() => {
                        setSelectedClass(cls)
                        setActiveStatus(null)
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-colors ${
                        selectedClass?.class_id === cls.class_id
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-900 border border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {cls.class_code}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected class card */}
              {selectedClass && (
                <motion.div
                  key={selectedClass.class_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-orange-500/20 text-orange-400 text-sm font-black px-2 py-0.5 rounded-lg">
                          {selectedClass.class_code}
                        </span>
                        {selectedClass.building_status && selectedClass.building_status !== 'normal' && (
                          <span className="text-lg">{statusEmoji[selectedClass.building_status]}</span>
                        )}
                      </div>
                      <p className="text-white font-bold mt-1">{selectedClass.class_name}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {selectedClass.department_name ?? 'No dept'} · Level {selectedClass.level ?? '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs">Location</p>
                      <p className="text-white text-sm font-bold">
                        {selectedClass.building_name ?? 'No building'}
                      </p>
                      <p className="text-zinc-600 text-xs">{selectedClass.room_name ?? '—'}</p>
                    </div>
                  </div>

                  {/* Last update */}
                  {selectedClass.last_status && (
                    <div className="bg-zinc-800 rounded-xl px-4 py-2 mb-4 flex items-center justify-between">
                      <span className="text-zinc-400 text-xs">Last update</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{statusEmoji[selectedClass.last_status]}</span>
                        <span className="text-zinc-300 text-xs capitalize">{selectedClass.last_status}</span>
                        <span className="text-zinc-600 text-xs">
                          {selectedClass.last_posted_at ? timeAgo(selectedClass.last_posted_at) : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3 font-bold">
                    Post Update
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {(Object.entries(STATUS_CONFIG) as [AnnouncementStatus, NonNullable<typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]>][]).map(
                      ([status, config]) => (
                        <motion.button
                          key={status}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setActiveStatus(activeStatus === status ? null : status)}
                          className={`border-2 rounded-xl py-4 flex flex-col items-center gap-1 transition-all ${
                            activeStatus === status
                              ? config.color
                              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          <span className="text-2xl">{config.emoji}</span>
                          <span className="text-xs font-black tracking-wider">{config.label}</span>
                          <span className="text-xs opacity-60">{config.sound}</span>
                        </motion.button>
                      )
                    )}
                  </div>

                  {/* Message input */}
                  <AnimatePresence>
                    {activeStatus && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={
                            activeStatus === 'pending' ? 'e.g. Lecturer not here yet. Stay close...'
                            : activeStatus === 'cancelled' ? 'e.g. Lecturer confirmed cancelled. Pack your bags.'
                            : activeStatus === 'confirmed' ? 'e.g. Lecturer in the building. Move!'
                            : 'e.g. Coming in 20 minutes. Hold on.'
                          }
                          rows={2}
                          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none mb-3"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Post button */}
                  <AnimatePresence>
                    {activeStatus && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        onClick={postAnnouncement}
                        disabled={posting}
                        className={`w-full py-4 rounded-xl font-black text-white text-base tracking-wider transition-all disabled:opacity-50 ${
                          STATUS_CONFIG[activeStatus]?.btn ?? 'bg-orange-500'
                        }`}
                      >
                        {posting
                          ? 'TRANSMITTING...'
                          : `${STATUS_CONFIG[activeStatus]?.emoji} BROADCAST ${activeStatus.toUpperCase()}`
                        }
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Error display */}
                <AnimatePresence>
                  {postError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center mt-3"
                    >
                      <p className="text-red-400 font-bold text-sm">Post Failed</p>
                      <p className="text-red-400/70 text-xs mt-1 break-all">{postError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                  {/* Success */}
                  <AnimatePresence>
                    {posted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center mt-3"
                      >
                        <p className="text-green-400 font-black text-lg">🔥 BROADCAST SENT</p>
                        <p className="text-green-400/60 text-xs mt-1">Campus is being notified</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Rep Stats */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-3">
                  Your Rep Stats
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Posts', value: classes[0]?.total_announcements ?? 0, icon: '📣' },
                    { label: 'Reliability', value: `${classes[0]?.reliability_score?.toFixed(0) ?? 0}%`, icon: '⭐' },
                    { label: 'Streak', value: `${classes[0]?.current_streak ?? 0}🔥`, icon: '🏆' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-zinc-800 rounded-xl p-3 text-center">
                      <p className="text-xl">{stat.icon}</p>
                      <p className="text-white font-black text-lg">{stat.value}</p>
                      <p className="text-zinc-500 text-xs">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* CAMPUS TV VIEW */}
      {view === 'tv' && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2 flex items-center gap-2 sticky top-0">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-black tracking-widest uppercase">Live</span>
            <span className="text-zinc-600 text-xs ml-auto">{user?.school?.name}</span>
          </div>

          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <div className="text-5xl mb-4">📺</div>
              <p className="text-zinc-400 font-bold">Campus is quiet</p>
              <p className="text-zinc-600 text-sm mt-2">No announcements yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {feed.map((item, i) => {
                const cls = item.target_type === 'class' ? classMap[item.target_id] : null
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`bg-zinc-900 rounded-2xl p-4 border-l-4 ${statusBorder[item.status] ?? 'border-zinc-700'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{statusEmoji[item.status] ?? '📣'}</span>
                        <div>
                          <p className="text-white font-black text-sm">
                            {cls ? cls.code : 'Campus'}{' '}
                            <span className="capitalize font-normal text-zinc-400">
                              {item.status}
                            </span>
                          </p>
                          {cls && (
                            <p className="text-zinc-600 text-xs">{cls.name}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-zinc-600 text-xs whitespace-nowrap ml-2">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {item.message && (
                      <p className="text-zinc-300 text-sm mb-2 italic">"{item.message}"</p>
                    )}

                    {item.voice_url && !item.voice_expired && (
                      <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 mb-2">
                        <span>🎙️</span>
                        <audio controls src={item.voice_url} className="h-6 flex-1" />
                        <span className="text-orange-400 text-xs font-bold">LIVE</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}