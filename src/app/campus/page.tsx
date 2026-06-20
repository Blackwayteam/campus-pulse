'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  playSound, playReactionSound, resumeAudio,
  startFireAmbient, stopFireAmbient,
  startRainAmbient, stopRainAmbient,
  VOLUME_FULL, VOLUME_AMBIENT
} from '@/lib/sounds'
import { motion, AnimatePresence } from 'framer-motion'

interface Building {
  id: string
  name: string
  short_name: string | null
  building_type: string
  x: number
  y: number
  width: number
  height: number
  color: string
  status: string
  status_set_at: string | null
}

interface FeedItem {
  id: string
  status: string
  message: string | null
  target_type: string
  target_id: string
  created_at: string
  created_by: string
}

interface ClassInfo {
  id: string
  code: string
  name: string
  level?: string | null
}

interface ReactionCount {
  [emoji: string]: number
}

interface Particle {
  id: number
  emoji: string
  x: number
  y: number
  vx: number
  scale: number
}

const STATUS_COLORS: Record<string, string> = {
  normal:    'border-zinc-600 bg-zinc-800',
  pending:   'border-orange-400 bg-orange-500/20',
  cancelled: 'border-red-500 bg-red-500/20',
  confirmed: 'border-blue-400 bg-blue-500/20',
  delayed:   'border-yellow-400 bg-yellow-500/20',
  warning:   'border-red-600 bg-red-600/20',
  broadcast: 'border-purple-400 bg-purple-500/20',
}

const STATUS_GLOW: Record<string, string> = {
  normal:    '',
  pending:   '0 0 20px rgba(251,146,60,0.6)',
  cancelled: '0 0 35px rgba(239,68,68,0.9)',
  confirmed: '0 0 20px rgba(96,165,250,0.6)',
  delayed:   '0 0 20px rgba(250,204,21,0.6)',
  warning:   '0 0 35px rgba(220,38,38,0.9)',
  broadcast: '0 0 20px rgba(192,132,252,0.6)',
}

const STATUS_EMOJI: Record<string, string> = {
  normal:    '🟢',
  pending:   '⚠️',
  cancelled: '🔥',
  confirmed: '✅',
  delayed:   '⏱️',
  warning:   '🚨',
  broadcast: '📣',
}

const statusBorder: Record<string, string> = {
  cancelled: 'border-red-500',
  confirmed: 'border-blue-500',
  delayed:   'border-yellow-500',
  pending:   'border-orange-500',
  broadcast: 'border-purple-500',
  warning:   'border-red-600',
}

const REACTIONS = ['🔥', '😂', '😭', '⚡', '☕', '🎉', '🔫']

// Relevance: full volume for your own classes and school-wide broadcasts, quiet ambient for everything else
function isRelevant(item: { target_type: string; target_id: string }, enrolled: Set<string>): boolean {
  if (item.target_type === 'school') return true
  if (item.target_type === 'class') return enrolled.has(item.target_id)
  return false
}

export default function CampusPage() {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [classMap, setClassMap] = useState<Record<string, ClassInfo>>({})
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([])
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set())
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCount>>({})
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [tab, setTab] = useState<'map' | 'feed' | 'classes'>('map')
  const [newAlert, setNewAlert] = useState<{ item: FeedItem; relevant: boolean } | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null)
  const particleId = useRef(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  useEffect(() => {
    const handler = () => resumeAudio()
    window.addEventListener('pointerdown', handler)
    window.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('visibilitychange', handler)
    }
  }, [])

  // Ambient sound tied to what's actually burning/raining on the map right now
  useEffect(() => {
    if (tab !== 'map' || !audioUnlocked) {
      stopFireAmbient()
      stopRainAmbient()
      return
    }

    const anyCancelled = buildings.some(b => b.status === 'cancelled' || b.status === 'warning')
    const anyConfirmed = buildings.some(b => b.status === 'confirmed')

    if (anyCancelled) startFireAmbient(0.5)
    else stopFireAmbient()

    if (anyConfirmed) startRainAmbient(0.35)
    else stopRainAmbient()

    return () => {
      // cleanup happens naturally on next effect run or unmount below
    }
  }, [buildings, tab, audioUnlocked])

  // Stop all ambient sound when leaving the page entirely
  useEffect(() => {
    return () => {
      stopFireAmbient()
      stopRainAmbient()
    }
  }, [])
  
  const channelRef = useRef<any>(null)
  const enrolledRef = useRef<Set<string>>(new Set())
  const feedMapRef = useRef<Record<string, FeedItem>>({})

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  useEffect(() => {
    enrolledRef.current = enrolledClassIds
  }, [enrolledClassIds])

  useEffect(() => {
    if (!user?.school?.id) return
    loadBuildings()
    loadFeed()
    loadMyClasses()
    subscribeToUpdates()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [user?.school?.id])

  async function loadBuildings() {
    const { data } = await supabase
      .from('buildings')
      .select('*')
      .eq('school_id', user?.school?.id)
      .order('created_at')
    setBuildings(data ?? [])
    setDataLoading(false)
  }

  async function loadFeed() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', user?.school?.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const items = data ?? []
    setFeed(items)
    feedMapRef.current = Object.fromEntries(items.map(i => [i.id, i]))

    const classIds = [...new Set(
      items.filter(a => a.target_type === 'class').map(a => a.target_id)
    )]
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from('classes')
        .select('id, code, name')
        .in('id', classIds)
      const map: Record<string, ClassInfo> = {}
      classes?.forEach(c => { map[c.id] = c })
      setClassMap(map)
    }

    if (items.length > 0) loadReactions(items.map(i => i.id))
  }

  async function loadMyClasses() {
    const { data: allC } = await supabase
      .from('classes')
      .select('id, code, name, level')
      .eq('school_id', user?.school?.id)
      .eq('active', true)
      .order('code')
    setAllClasses(allC ?? [])

    const { data: enrolled } = await supabase
      .from('class_enrollments')
      .select('class_id')
      .eq('user_id', user?.id)

    setEnrolledClassIds(new Set((enrolled ?? []).map(e => e.class_id)))
  }

  async function joinClass(classId: string) {
    setJoiningClassId(classId)
    await supabase.from('class_enrollments').insert({
      school_id: user?.school?.id,
      class_id: classId,
      user_id: user?.id,
    })
    setEnrolledClassIds(prev => new Set([...prev, classId]))
    setJoiningClassId(null)
  }

  async function leaveClass(classId: string) {
    setJoiningClassId(classId)
    await supabase
      .from('class_enrollments')
      .delete()
      .eq('user_id', user?.id)
      .eq('class_id', classId)
    setEnrolledClassIds(prev => {
      const next = new Set(prev)
      next.delete(classId)
      return next
    })
    setJoiningClassId(null)
  }

  async function loadReactions(announcementIds: string[]) {
    const { data } = await supabase
      .from('reactions')
      .select('announcement_id, emoji')
      .in('announcement_id', announcementIds)

    const counts: Record<string, ReactionCount> = {}
    data?.forEach(r => {
      if (!counts[r.announcement_id]) counts[r.announcement_id] = {}
      counts[r.announcement_id][r.emoji] = (counts[r.announcement_id][r.emoji] ?? 0) + 1
    })
    setReactionCounts(counts)
  }

  function subscribeToUpdates() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel(`campus:${user?.school?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements',
        filter: `school_id=eq.${user?.school?.id}`,
      }, (payload) => {
        const item = payload.new as FeedItem
        const relevant = isRelevant(item, enrolledRef.current)
        if (item.created_by !== user?.id) {
          playSound(item.status, relevant ? VOLUME_FULL : VOLUME_AMBIENT)
        }
        setNewAlert({ item, relevant })
        setTimeout(() => setNewAlert(null), 4000)
        loadFeed()
        loadBuildings()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'buildings',
        filter: `school_id=eq.${user?.school?.id}`,
      }, () => {
        loadBuildings()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reactions',
        filter: `school_id=eq.${user?.school?.id}`,
      }, (payload) => {
        const reaction = payload.new as any
        if (reaction.user_id !== user?.id) {
          const target = feedMapRef.current[reaction.announcement_id]
          const relevant = target ? isRelevant(target, enrolledRef.current) : false
          playReactionSound(reaction.emoji, relevant ? VOLUME_FULL : VOLUME_AMBIENT)
        }
        setReactionCounts(prev => {
          const updated = { ...prev }
          const id = reaction.announcement_id
          if (!updated[id]) updated[id] = {}
          updated[id][reaction.emoji] = (updated[id][reaction.emoji] ?? 0) + 1
          return updated
        })
      })
      .subscribe()
  }

  function spawnParticles(emoji: string, event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top

    const count = 7
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: particleId.current++,
      emoji,
      x: cx + (Math.random() - 0.5) * 50,
      y: cy,
      vx: (Math.random() - 0.5) * 60,
      scale: 0.9 + Math.random() * 0.8,
    }))

    setParticles(prev => [...prev, ...newParticles])

    setTimeout(() => {
      const ids = new Set(newParticles.map(p => p.id))
      setParticles(prev => prev.filter(p => !ids.has(p.id)))
    }, 1400)
  }

  async function react(announcementId: string, emoji: string, event: React.MouseEvent<HTMLButtonElement>) {
    // Your own reaction always plays at full volume — it's your action
    playReactionSound(emoji, VOLUME_FULL)
    spawnParticles(emoji, event)

    setReactionCounts(prev => {
      const updated = { ...prev }
      if (!updated[announcementId]) updated[announcementId] = {}
      updated[announcementId][emoji] = (updated[announcementId][emoji] ?? 0) + 1
      return updated
    })

    await supabase.from('reactions').insert({
      school_id: user?.school?.id,
      announcement_id: announcementId,
      user_id: user?.id,
      emoji,
    })
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
          <div className="text-5xl mb-4 animate-pulse">🏫</div>
          <p className="text-orange-500 font-bold animate-pulse">Loading Campus...</p>
        </div>
      </div>
    )
  }

  if (!audioUnlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.button
          onClick={() => {
            // Plays a silent blip to unlock audio on this device
            playSound('confirmed', 0.0001)
            setAudioUnlocked(true)
          }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-orange-500 text-white font-black px-8 py-5 rounded-2xl text-lg flex flex-col items-center gap-2"
        >
          <span className="text-3xl">🔊</span>
          Tap to Enter Campus
          <span className="text-xs font-normal opacity-80">Turns on live sound + alerts</span>
        </motion.button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* PARTICLE OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-[100]">
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute text-3xl select-none"
              style={{ left: p.x, top: p.y }}
              initial={{ opacity: 1, scale: p.scale, y: 0, x: 0 }}
              animate={{
                opacity: 0,
                y: -(120 + Math.random() * 100),
                x: p.vx,
                scale: p.scale * 1.6,
              }}
              transition={{ duration: 1.0 + Math.random() * 0.4, ease: 'easeOut' }}
            >
              {p.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h1 className="text-base font-black tracking-tight">
                {user?.school?.name}
              </h1>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-zinc-500 text-xs">Live</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-400 text-xs">{user?.profile?.full_name}</p>
            <p className="text-zinc-600 text-xs capitalize">
              {user?.role?.role_type ?? 'Student'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setTab('map')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              tab === 'map' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            🗺️ Map
          </button>
          <button
            onClick={() => setTab('feed')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors relative ${
              tab === 'feed' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            📺 Feed
            {feed.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-black">
                {feed.length > 9 ? '9+' : feed.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('classes')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors relative ${
              tab === 'classes' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            📚 Classes
            {enrolledClassIds.size === 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 w-2.5 h-2.5 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Join classes nudge */}
      {enrolledClassIds.size === 0 && tab !== 'classes' && (
        <button
          onClick={() => setTab('classes')}
          className="mx-4 mt-3 bg-orange-500/15 border border-orange-500/40 rounded-xl px-4 py-3 text-left flex items-center gap-3"
        >
          <span className="text-xl">📚</span>
          <div>
            <p className="text-orange-300 text-sm font-bold">Join your classes</p>
            <p className="text-orange-400/70 text-xs">Get loud, full alerts when YOUR class is cancelled or confirmed</p>
          </div>
        </button>
      )}

      {/* BREAKING ALERT */}
      <AnimatePresence>
        {newAlert && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            className={`mx-4 mt-3 rounded-2xl p-4 border-2 ${!newAlert.relevant ? 'opacity-70' : ''} ${
              newAlert.item.status === 'cancelled' ? 'bg-red-500/20 border-red-500' :
              newAlert.item.status === 'confirmed' ? 'bg-blue-500/20 border-blue-500' :
              newAlert.item.status === 'pending'   ? 'bg-orange-500/20 border-orange-500' :
              'bg-yellow-500/20 border-yellow-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <motion.span
                className={newAlert.relevant ? 'text-3xl' : 'text-2xl'}
                animate={{ scale: newAlert.relevant ? [1, 1.3, 1] : [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
              >
                {STATUS_EMOJI[newAlert.item.status] ?? '📣'}
              </motion.span>
              <div className="flex-1">
                {newAlert.relevant && (
                  <p className="text-orange-300 text-xs font-black tracking-wider mb-0.5">📌 YOUR CLASS</p>
                )}
                <p className={`text-white font-black ${newAlert.relevant ? 'text-sm' : 'text-xs'}`}>
                  {newAlert.item.status === 'cancelled' && '🔥 CLASS IS BURNING'}
                  {newAlert.item.status === 'confirmed' && '✅ CLASS IS ON — MOVE'}
                  {newAlert.item.status === 'pending'   && '⚠️ STAY TUNED'}
                  {newAlert.item.status === 'delayed'   && '⏱️ CLASS DELAYED'}
                  {newAlert.item.status === 'broadcast' && '📣 BROADCAST'}
                </p>
                {newAlert.item.message && (
                  <p className="text-white/70 text-xs mt-0.5 italic">"{newAlert.item.message}"</p>
                )}
              </div>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAP TAB */}
      {tab === 'map' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div
            className="flex-1 relative bg-zinc-900 m-4 rounded-2xl overflow-hidden border border-zinc-800"
            style={{ minHeight: '55vh' }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />
            <div className="absolute top-3 left-3 bg-black/60 rounded-lg px-2 py-1">
              <p className="text-zinc-400 text-xs font-bold tracking-widest uppercase">
                {user?.school?.name} Campus
              </p>
            </div>
            {buildings.map((b) => (
              <BuildingBlock
                key={b.id}
                building={b}
                onPress={() => setSelectedBuilding(
                  selectedBuilding?.id === b.id ? null : b
                )}
                selected={selectedBuilding?.id === b.id}
              />
            ))}
            {buildings.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-zinc-600 text-sm">No buildings added yet</p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedBuilding && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="mx-4 mb-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{STATUS_EMOJI[selectedBuilding.status]}</div>
                    <div>
                      <p className="text-white font-black text-lg">{selectedBuilding.name}</p>
                      <p className="text-zinc-500 text-xs capitalize">
                        {selectedBuilding.building_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBuilding(null)}
                    className="text-zinc-600 hover:text-white text-xl"
                  >✕</button>
                </div>

                <div className={`rounded-xl px-4 py-3 border ${STATUS_COLORS[selectedBuilding.status]} mb-3`}>
                  <p className="font-black text-sm">
                    {selectedBuilding.status === 'normal'    && '🟢 All Clear'}
                    {selectedBuilding.status === 'cancelled' && '🔥 ON FIRE — Class Cancelled'}
                    {selectedBuilding.status === 'confirmed' && '🌧️ Rain Mode — Class Confirmed'}
                    {selectedBuilding.status === 'delayed'   && '⏱️ Class Delayed'}
                    {selectedBuilding.status === 'pending'   && '⚠️ Stay Tuned'}
                    {selectedBuilding.status === 'warning'   && '🚨 Warning'}
                    {selectedBuilding.status === 'broadcast' && '📣 Broadcast Active'}
                  </p>
                  {selectedBuilding.status_set_at && (
                    <p className="text-xs opacity-60 mt-1">
                      Updated {timeAgo(selectedBuilding.status_set_at)}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedBuilding && (
            <div className="mx-4 mb-4 flex gap-3 overflow-x-auto pb-1">
              {[
                { status: 'normal',    label: 'Clear' },
                { status: 'cancelled', label: 'Burnt' },
                { status: 'confirmed', label: 'On' },
                { status: 'delayed',   label: 'Late' },
                { status: 'pending',   label: 'Watch' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-sm">{STATUS_EMOJI[item.status]}</span>
                  <span className="text-zinc-500 text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FEED TAB */}
      {tab === 'feed' && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2 flex items-center gap-2 sticky top-0 z-10">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-black tracking-widest">LIVE</span>
            <span className="text-zinc-600 text-xs ml-auto">{feed.length} updates</span>
          </div>

          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <div className="text-5xl mb-4">📺</div>
              <p className="text-zinc-400 font-bold">Campus is quiet</p>
              <p className="text-zinc-600 text-sm mt-2">No announcements yet.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {feed.map((item, i) => {
                const cls = item.target_type === 'class' ? classMap[item.target_id] : null
                const counts = reactionCounts[item.id] ?? {}
                const relevant = isRelevant(item, enrolledClassIds)

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-zinc-900 rounded-2xl p-4 border-l-4 ${statusBorder[item.status] ?? 'border-zinc-700'} ${relevant ? 'ring-1 ring-orange-500/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{STATUS_EMOJI[item.status] ?? '📣'}</span>
                        <div>
                          <p className="text-white font-black text-sm flex items-center gap-1.5 flex-wrap">
                            {cls ? cls.code : 'Campus'}{' '}
                            <span className="capitalize font-normal text-zinc-400">{item.status}</span>
                            {relevant && (
                              <span className="bg-orange-500/20 text-orange-400 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                YOUR CLASS
                              </span>
                            )}
                          </p>
                          {cls && <p className="text-zinc-600 text-xs">{cls.name}</p>}
                        </div>
                      </div>
                      <span className="text-zinc-600 text-xs whitespace-nowrap ml-2">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {item.message && (
                      <p className="text-zinc-300 text-sm mb-3 italic">"{item.message}"</p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mt-3">
                      {REACTIONS.map((emoji) => {
                        const count = counts[emoji] ?? 0
                        return (
                          <motion.button
                            key={emoji}
                            whileTap={{ scale: 1.4 }}
                            onClick={(e) => react(item.id, emoji, e)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all active:scale-125 ${
                              count > 0
                                ? 'bg-zinc-700 border border-zinc-600 text-white'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-500'
                            }`}
                          >
                            <span>{emoji}</span>
                            {count > 0 && (
                              <motion.span
                                key={count}
                                initial={{ scale: 1.4, color: '#f97316' }}
                                animate={{ scale: 1, color: '#a1a1aa' }}
                                className="text-xs font-black"
                              >
                                {count}
                              </motion.span>
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* CLASSES TAB */}
      {tab === 'classes' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-2">
            <p className="text-white font-bold text-sm mb-1">📚 Your Classes</p>
            <p className="text-zinc-500 text-xs">
              Join the classes you're taking to get loud, full alerts when something happens. Other campus activity still plays quietly in the background so you don't miss the vibe.
            </p>
          </div>

          {allClasses.length === 0 ? (
            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">📖</div>
              <p className="text-zinc-400 font-medium">No classes added yet</p>
              <p className="text-zinc-600 text-sm mt-1">Ask your school admin to add classes</p>
            </div>
          ) : (
            allClasses.map((c) => {
              const joined = enrolledClassIds.has(c.id)
              return (
                <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black ${
                      joined ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {c.code}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{c.name}</p>
                      <p className="text-zinc-500 text-xs">
                        {c.code}{c.level ? ` · Level ${c.level}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => joined ? leaveClass(c.id) : joinClass(c.id)}
                    disabled={joiningClassId === c.id}
                    className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                      joined
                        ? 'bg-zinc-800 text-zinc-400 hover:text-red-400'
                        : 'bg-orange-500 hover:bg-orange-400 text-white'
                    }`}
                  >
                    {joiningClassId === c.id ? '...' : joined ? 'Joined ✓' : 'Join'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

    </div>
  )
}

function BuildingBlock({
  building, onPress, selected
}: {
  building: Building
  onPress: () => void
  selected: boolean
}) {
  const isActive = building.status !== 'normal'

  return (
    <motion.button
      onClick={onPress}
      className="absolute flex flex-col items-center justify-center rounded-xl border-2 overflow-hidden"
      style={{
        left: `${building.x}%`,
        top: `${building.y}%`,
        width: `${building.width}%`,
        height: `${building.height}%`,
        borderColor: selected ? '#f97316' : getStatusColor(building.status),
        backgroundColor: getStatusBg(building.status),
        boxShadow: selected
          ? '0 0 0 3px rgba(249,115,22,0.5), ' + (STATUS_GLOW[building.status] ?? '')
          : STATUS_GLOW[building.status] ?? 'none',
      }}
      animate={
        building.status === 'cancelled'
          ? { x: [0, -5, 5, -4, 4, -2, 2, 0], transition: { repeat: Infinity, duration: 0.35 } }
          : building.status === 'pending'
          ? { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 1.4 } }
          : building.status === 'delayed'
          ? { opacity: [1, 0.55, 1], transition: { repeat: Infinity, duration: 1.0 } }
          : { x: 0, scale: 1, opacity: 1 }
      }
    >
      {/* CANCELLED — full burning overlay, three flames */}
      {building.status === 'cancelled' && (
        <>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.55), transparent 70%)' }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          />
          <motion.div
            className="absolute -bottom-1 left-1/4 text-2xl pointer-events-none"
            animate={{ y: [0, -10, 0], scale: [1, 1.4, 1], rotate: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
          >🔥</motion.div>
          <motion.div
            className="absolute -bottom-1 right-1/4 text-xl pointer-events-none"
            animate={{ y: [0, -8, 0], scale: [1, 1.3, 1], rotate: [5, -5, 5] }}
            transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut', delay: 0.1 }}
          >🔥</motion.div>
          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl pointer-events-none"
            animate={{ y: [0, -12, 0], scale: [1, 1.35, 1] }}
            transition={{ repeat: Infinity, duration: 0.55, ease: 'easeInOut', delay: 0.05 }}
          >🔥</motion.div>
        </>
      )}

      {/* CONFIRMED — full rain overlay, falling droplets */}
      {building.status === 'confirmed' && (
        <>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.4), transparent 70%)' }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          />
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute text-lg pointer-events-none"
              style={{ left: `${20 + i * 30}%`, top: '0%' }}
              animate={{ y: [0, 40, 0], opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.25, ease: 'linear' }}
            >💧</motion.div>
          ))}
        </>
      )}

      {/* PENDING — warning pulse */}
      {building.status === 'pending' && (
        <motion.div
          className="absolute top-1 right-1 text-base pointer-events-none"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        >⚠️</motion.div>
      )}

      {/* Building name */}
      <p
        className="font-black text-center leading-tight z-10 drop-shadow-lg"
        style={{
          fontSize: `clamp(7px, ${building.width * 0.65}vw, 12px)`,
          color: isActive ? '#fff' : '#94a3b8',
        }}
      >
        {building.short_name ?? building.name}
      </p>

      {/* Status label badge — impossible to miss, always shows the word */}
      {isActive && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-black whitespace-nowrap z-20"
          style={{ backgroundColor: getStatusColor(building.status), color: '#000' }}
        >
          {building.status === 'cancelled' && '🔥 BURNING'}
          {building.status === 'confirmed' && '✅ ON'}
          {building.status === 'delayed' && '⏱️ LATE'}
          {building.status === 'pending' && '⚠️ WATCH'}
          {building.status === 'warning' && '🚨 ALERT'}
          {building.status === 'broadcast' && '📣 LIVE'}
        </div>
      )}
    </motion.button>
  )
}
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    normal:    '#52525b',
    cancelled: '#ef4444',
    confirmed: '#60a5fa',
    delayed:   '#facc15',
    pending:   '#fb923c',
    warning:   '#dc2626',
    broadcast: '#c084fc',
  }
  return colors[status] ?? '#52525b'
}

function getStatusBg(status: string): string {
  const colors: Record<string, string> = {
    normal:    'rgba(39,39,42,0.9)',
    cancelled: 'rgba(239,68,68,0.3)',
    confirmed: 'rgba(96,165,250,0.2)',
    delayed:   'rgba(250,204,21,0.2)',
    pending:   'rgba(251,146,60,0.25)',
    warning:   'rgba(220,38,38,0.35)',
    broadcast: 'rgba(192,132,252,0.2)',
  }
  return colors[status] ?? 'rgba(39,39,42,0.9)'
}