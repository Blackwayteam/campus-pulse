'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { getAuthUser } from '@/lib/auth'
import { motion } from 'framer-motion'

export default function OnboardingPage() {
  const { user, setUser } = useAuthStore()
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [school, setSchool] = useState<any>(null)
  const [step, setStep] = useState<'search' | 'confirm'>('search')

  async function findSchool() {
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
    if (!school || !user?.id) return
    setLoading(true)
    setError('')

    // Link user to school
    const { error: userErr } = await supabase
      .from('users')
      .update({ school_id: school.id })
      .eq('id', user.id)

    if (userErr) {
      setError('Failed to join school. Try again.')
      setLoading(false)
      return
    }

    // Create student role
    const { error: roleErr } = await supabase
      .from('roles')
      .insert({
        school_id: school.id,
        user_id: user.id,
        role_type: 'student',
      })

    if (roleErr && !roleErr.message.includes('duplicate')) {
      setError('Failed to set role. Try again.')
      setLoading(false)
      return
    }

    // Reload auth user with new school and role
    const updatedUser = await getAuthUser()
    setUser(updatedUser)

    router.push('/campus')
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
            Join your campus
          </p>
        </div>

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
              Enter your school's Campus Pulse name to join
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-zinc-400 text-sm mb-1 block">
                  School name
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && findSchool()}
                  placeholder="e.g. knust, ucc, upsa"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors lowercase"
                />
                <p className="text-zinc-600 text-xs mt-1 px-1">
                  Ask your course rep or school admin for the exact name
                </p>
              </div>

              <button
                onClick={findSchool}
                disabled={loading || !slug}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-colors"
              >
                {loading ? 'Searching...' : 'Find My School'}
              </button>
            </div>
          </motion.div>
        )}

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
            <div
              className="rounded-2xl p-5 mb-6 border border-zinc-700 text-center"
              style={{ backgroundColor: (school.school_color ?? '#FF6B35') + '22' }}
            >
              <div className="text-5xl mb-3">🏫</div>
              <h3 className="text-white text-2xl font-black">{school.name}</h3>
              <p className="text-zinc-400 text-sm mt-1">/{school.slug}</p>
              <div className="flex items-center justify-center gap-2 mt-3">
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
                }}
                className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-3 text-sm font-bold"
              >
                Not mine
              </button>
              <button
                onClick={joinSchool}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold rounded-xl py-3 text-sm transition-colors"
              >
                {loading ? 'Joining...' : '🔥 Join Campus'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Welcome message */}
        <p className="text-zinc-600 text-xs text-center mt-6">
          Welcome, {user?.profile?.full_name}. Your campus is waiting.
        </p>

      </div>
    </div>
  )
}