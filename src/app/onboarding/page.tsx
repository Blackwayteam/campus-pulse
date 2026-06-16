'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'

export default function OnboardingPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [school, setSchool] = useState<any>(null)
  const [step, setStep] = useState<'search' | 'confirm' | 'done'>('search')

  // Get the current user directly from Supabase — no store needed
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('full_name, school_id')
        .eq('id', user.id)
        .single()

      if (profile?.school_id) {
        // Already has a school — go to campus
        router.push('/campus')
        return
      }

      setUserName(profile?.full_name ?? '')
    }
    getUser()
  }, [])

  async function findSchool() {
    if (!slug.trim()) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', slug.toLowerCase().trim())
      .eq('active', true)
      .single()

    if (err || !data) {
      setError('School not found. Check the name and try again.')
      setLoading(false)
      return
    }

    setSchool(data)
    setStep('confirm')
    setLoading(false)
  }

  async function joinSchool() {
    if (!school || !userId) {
      setError('Session expired. Please refresh the page.')
      return
    }

    setLoading(true)
    setError('')

    // Update user school_id
    const { error: e1 } = await supabase
      .from('users')
      .update({ school_id: school.id })
      .eq('id', userId)

    if (e1) {
      setError(`Could not join: ${e1.message}`)
      setLoading(false)
      return
    }

    // Insert student role
    const { error: e2 } = await supabase
      .from('roles')
      .insert({
        school_id: school.id,
        user_id: userId,
        role_type: 'student',
      })

    if (e2 && !e2.message.includes('duplicate')) {
      setError(`Could not set role: ${e2.message}`)
      setLoading(false)
      return
    }

    setStep('done')

    // Small delay so user sees the success screen
    setTimeout(() => {
      router.push('/campus')
    }, 1500)
  }

  // DONE SCREEN
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-7xl mb-4">🔥</div>
          <h1 className="text-white text-3xl font-black mb-2">You're In</h1>
          <p className="text-orange-400 font-medium">Loading your campus...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            className="text-6xl mb-3"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            🔥
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            CAMPUS PULSE
          </h1>
          <p className="text-orange-400 mt-1 text-sm font-medium">
            {userName ? `Welcome, ${userName}` : 'Join your campus'}
          </p>
        </div>

        {/* SEARCH STEP */}
        {step === 'search' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
          >
            <h2 className="text-white text-xl font-bold mb-2">
              Find Your School
            </h2>
            <p className="text-zinc-500 text-sm mb-6">
              Enter your school's Campus Pulse ID to join
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-zinc-400 text-sm mb-1 block">
                  School ID
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  onKeyDown={(e) => e.key === 'Enter' && findSchool()}
                  placeholder="e.g. knust, ucc, demo-university"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
                <p className="text-zinc-600 text-xs mt-1 px-1">
                  Ask your course rep or school admin for the exact ID
                </p>
              </div>

              <button
                onClick={findSchool}
                disabled={loading || !slug.trim()}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-colors"
              >
                {loading ? 'Searching...' : 'Find My School 🔍'}
              </button>
            </div>
          </motion.div>
        )}

        {/* CONFIRM STEP */}
        {step === 'confirm' && school && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
          >
            <h2 className="text-white text-xl font-bold mb-6">
              Is this your school?
            </h2>

            {/* School card */}
            <div className="rounded-2xl p-6 mb-6 border border-zinc-700 bg-zinc-800 text-center">
              <div className="text-5xl mb-3">🏫</div>
              <h3 className="text-white text-2xl font-black">{school.name}</h3>
              <p className="text-zinc-500 text-sm mt-1">/{school.slug}</p>
              <div className="mt-3">
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  school.plan_status === 'premium'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {school.plan_status}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('search')
                  setSchool(null)
                  setError('')
                  setSlug('')
                }}
                className="flex-1 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl py-3 text-sm font-bold transition-colors"
              >
                Not mine
              </button>
              <button
                onClick={joinSchool}
                disabled={loading || !userId}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold rounded-xl py-3 text-sm transition-colors"
              >
                {loading ? 'Joining...' : '🔥 Join Campus'}
              </button>
            </div>

            {!userId && (
              <p className="text-zinc-600 text-xs text-center mt-3">
                Loading your session...
              </p>
            )}
          </motion.div>
        )}

      </div>
    </div>
  )
}