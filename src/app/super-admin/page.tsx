'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SchoolRow {
  id: string
  name: string
  slug: string
  plan_status: string
  active: boolean
  created_at: string
}

interface TogglesRow {
  school_id: string
  fire_mode_enabled: boolean
  rain_mode_enabled: boolean
  building_shake_enabled: boolean
  campus_tv_enabled: boolean
  anticipation_mode_enabled: boolean
  reactions_enabled: boolean
  leaderboard_enabled: boolean
  custom_sounds_enabled: boolean
  voice_broadcast_enabled: boolean
  hero_roles_enabled: boolean
  analytics_enabled: boolean
  speaker_mode_enabled: boolean
  schematic_3d_map_enabled: boolean
}

type Tab = 'schools' | 'toggles' | 'sounds' | 'analytics'

export default function SuperAdminPage() {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('schools')
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [selectedSchool, setSelectedSchool] = useState<SchoolRow | null>(null)
  const [toggles, setToggles] = useState<TogglesRow | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [savingToggle, setSavingToggle] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.role?.role_type !== 'super_admin') {
      router.push('/campus')
    }
  }, [user, loading])

  useEffect(() => {
    if (user) loadSchools()
  }, [user])

  async function loadSchools() {
    setDataLoading(true)
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at')

    if (error) console.error('Schools error:', error)
    const list = data ?? []
    setSchools(list)
    if (list.length > 0 && !selectedSchool) {
      setSelectedSchool(list[0])
      loadToggles(list[0].id)
    }
    setDataLoading(false)
  }

  async function loadToggles(schoolId: string) {
    const { data, error } = await supabase
      .from('feature_toggles')
      .select('*')
      .eq('school_id', schoolId)
      .single()

    if (error) console.error('Toggles error:', error)
    setToggles(data ?? null)
  }

  async function updateToggle(key: string, value: boolean) {
    if (!selectedSchool) return
    setSavingToggle(key)
    setToggles((prev) => prev ? { ...prev, [key]: value } : prev)

    const { error } = await supabase
      .from('feature_toggles')
      .update({ [key]: value })
      .eq('school_id', selectedSchool.id)

    if (error) console.error('Toggle save error:', error)
    setSavingToggle(null)
  }

  async function updatePlan(schoolId: string, plan: string) {
    await supabase.from('schools').update({ plan_status: plan }).eq('id', schoolId)
    loadSchools()
  }

  const planColors: Record<string, string> = {
    free: 'bg-zinc-700 text-zinc-300',
    premium: 'bg-orange-500/20 text-orange-400',
    trial: 'bg-blue-500/20 text-blue-400',
    suspended: 'bg-red-500/20 text-red-400',
    custom: 'bg-purple-500/20 text-purple-400',
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 text-2xl font-bold animate-pulse">
          Loading Super Admin...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <h1 className="text-2xl font-black tracking-tight">CAMPUS PULSE</h1>
            </div>
            <p className="text-zinc-500 text-sm mt-1">Super Admin Control Center</p>
          </div>
          <div className="text-right">
            <p className="text-white font-medium">{user?.profile?.full_name}</p>
            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 bg-zinc-950 border-b border-zinc-800 overflow-x-auto">
        {(['schools', 'toggles', 'sounds', 'analytics'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors capitalize ${
              activeTab === tab ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4">

        {/* SCHOOLS TAB */}
        {activeTab === 'schools' && (
          <div className="space-y-4">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Schools', value: schools.length, icon: '🏫' },
                { label: 'Premium', value: schools.filter(s => s.plan_status === 'premium').length, icon: '⭐' },
                { label: 'Trial', value: schools.filter(s => s.plan_status === 'trial').length, icon: '🕐' },
                { label: 'Suspended', value: schools.filter(s => s.plan_status === 'suspended').length, icon: '🚫' },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="text-zinc-500 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Schools list */}
            <div className="space-y-3">
              <h2 className="text-white font-bold">All Schools</h2>
              {schools.map((school) => (
                <div key={school.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-bold">{school.name}</p>
                      <p className="text-zinc-500 text-xs">/{school.slug}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold capitalize ${planColors[school.plan_status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                      {school.plan_status}
                    </span>
                  </div>

                  {/* Plan controls */}
                  <div className="flex gap-2 flex-wrap">
                    {['free', 'trial', 'premium', 'suspended'].map((plan) => (
                      <button
                        key={plan}
                        onClick={() => updatePlan(school.id, plan)}
                        className={`text-xs px-3 py-1 rounded-lg font-bold transition-colors capitalize ${
                          school.plan_status === plan
                            ? 'bg-orange-500 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setSelectedSchool(school)
                        loadToggles(school.id)
                        setActiveTab('toggles')
                      }}
                      className="text-xs px-3 py-1 rounded-lg font-bold bg-zinc-800 text-zinc-400 hover:text-orange-400 transition-colors"
                    >
                      ⚡ Toggles →
                    </button>
                  </div>
                </div>
              ))}

              <button className="w-full border border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 rounded-xl py-4 text-sm transition-colors">
                + Add New School
              </button>
            </div>
          </div>
        )}

        {/* TOGGLES TAB */}
        {activeTab === 'toggles' && (
          <div className="space-y-4">

            {/* School selector */}
            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">
                Managing toggles for:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {schools.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSchool(s)
                      loadToggles(s.id)
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedSchool?.id === s.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-900 border border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {toggles ? (
              <div className="space-y-3">

                {/* Map */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-3">🗺️ Map</h3>
                  <div className="space-y-4">
                    {[
                      { label: '3D Isometric Map', key: 'schematic_3d_map_enabled', premium: true },
                    ].map((t) => (
                      <ToggleRow key={t.key} label={t.label} value={toggles[t.key as keyof TogglesRow] as boolean} premium={t.premium} saving={savingToggle === t.key} onToggle={(v) => updateToggle(t.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Animations */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-3">🔥 Animations</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Fire Mode', key: 'fire_mode_enabled' },
                      { label: 'Rain Mode', key: 'rain_mode_enabled' },
                      { label: 'Building Shake', key: 'building_shake_enabled' },
                    ].map((t) => (
                      <ToggleRow key={t.key} label={t.label} value={toggles[t.key as keyof TogglesRow] as boolean} saving={savingToggle === t.key} onToggle={(v) => updateToggle(t.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Announcements */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-3">📣 Announcements</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Anticipation Mode (Pending)', key: 'anticipation_mode_enabled' },
                      { label: 'Campus TV', key: 'campus_tv_enabled' },
                      { label: 'Voice Broadcasts', key: 'voice_broadcast_enabled', premium: true },
                    ].map((t) => (
                      <ToggleRow key={t.key} label={t.label} value={toggles[t.key as keyof TogglesRow] as boolean} premium={t.premium} saving={savingToggle === t.key} onToggle={(v) => updateToggle(t.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Sound */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-3">🔊 Sound</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Speaker Mode', key: 'speaker_mode_enabled' },
                      { label: 'Custom Sounds', key: 'custom_sounds_enabled', premium: true },
                    ].map((t) => (
                      <ToggleRow key={t.key} label={t.label} value={toggles[t.key as keyof TogglesRow] as boolean} premium={t.premium} saving={savingToggle === t.key} onToggle={(v) => updateToggle(t.key, v)} />
                    ))}
                  </div>
                </div>

                {/* Social */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-3">🏆 Social</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Reactions', key: 'reactions_enabled' },
                      { label: 'Leaderboard', key: 'leaderboard_enabled' },
                      { label: 'Hero Roles', key: 'hero_roles_enabled', premium: true },
                      { label: 'Analytics', key: 'analytics_enabled', premium: true },
                    ].map((t) => (
                      <ToggleRow key={t.key} label={t.label} value={toggles[t.key as keyof TogglesRow] as boolean} premium={t.premium} saving={savingToggle === t.key} onToggle={(v) => updateToggle(t.key, v)} />
                    ))}
                  </div>
                </div>

                <p className="text-zinc-600 text-xs text-center">
                  Changes save instantly to Supabase
                </p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
                <p className="text-zinc-400">Select a school above to manage its toggles</p>
              </div>
            )}
          </div>
        )}

        {/* SOUNDS TAB */}
        {activeTab === 'sounds' && (
          <div className="space-y-3">
            <h2 className="text-white font-bold">Sound Packs</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <p className="text-zinc-400 text-sm mb-4">
                Default sounds are generated programmatically. Custom sound uploads coming in Phase 4.
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Fire Siren', status: 'cancelled', desc: '3 dramatic descending wails' },
                  { name: 'Rain Chime', status: 'confirmed', desc: 'Ascending bell tones' },
                  { name: 'Warning Beep', status: 'delayed', desc: 'Double pulse' },
                  { name: 'Tension Drone', status: 'pending', desc: 'Ominous vibrating build-up' },
                  { name: 'Broadcast Fanfare', status: 'broadcast', desc: 'Triumphant four-note' },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{s.name}</p>
                      <p className="text-zinc-500 text-xs">{s.desc}</p>
                    </div>
                    <span className="text-green-400 text-xs font-bold">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-3">
            <h2 className="text-white font-bold">Analytics</h2>
            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-zinc-400 font-medium">Coming in Phase 6</p>
              <p className="text-zinc-600 text-sm mt-1">School usage, rep activity, and platform stats</p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 px-6 py-4">
        <div className="flex justify-around max-w-md mx-auto">
          {[
            { icon: '🏫', label: 'Schools', tab: 'schools' },
            { icon: '⚡', label: 'Toggles', tab: 'toggles' },
            { icon: '🔊', label: 'Sounds', tab: 'sounds' },
            { icon: '📊', label: 'Analytics', tab: 'analytics' },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab as Tab)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === item.tab ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

// Reusable toggle component
function ToggleRow({
  label,
  value,
  premium,
  saving,
  onToggle,
}: {
  label: string
  value: boolean
  premium?: boolean
  saving: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-zinc-300 text-sm">{label}</span>
        {premium && (
          <span className="ml-2 text-xs text-orange-400 font-bold">PREMIUM</span>
        )}
      </div>
      <button
        onClick={() => onToggle(!value)}
        disabled={saving}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${
          value ? 'bg-orange-500' : 'bg-zinc-700'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
          value ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )
}