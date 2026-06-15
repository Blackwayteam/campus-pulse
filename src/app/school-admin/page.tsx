'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building, Department, Class } from '@/types'

type Tab = 'overview' | 'buildings' | 'departments' | 'classes' | 'reps' | 'settings'

export default function SchoolAdminPage() {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [buildings, setBuildings] = useState<Building[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [toggles, setToggles] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)

  // Modal states
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [showAddDept, setShowAddDept] = useState(false)
  const [showAddClass, setShowAddClass] = useState(false)

  // Form states
  const [buildingName, setBuildingName] = useState('')
  const [buildingType, setBuildingType] = useState('lecture_hall')
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [className, setClassName] = useState('')
  const [classCode, setClassCode] = useState('')
  const [classLevel, setClassLevel] = useState('')
  const [classDept, setClassDept] = useState('')
  const [classBuilding, setClassBuilding] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  useEffect(() => {
    if (user?.school?.id) loadData()
  }, [user])

  async function loadData() {
    setDataLoading(true)
    const schoolId = user?.school?.id

    const [b, d, c, t] = await Promise.all([
      supabase.from('buildings').select('*').eq('school_id', schoolId).order('created_at'),
      supabase.from('departments').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('code'),
      supabase.from('feature_toggles').select('*').eq('school_id', schoolId).single(),
    ])

    setBuildings(b.data ?? [])
    setDepartments(d.data ?? [])
    setClasses(c.data ?? [])
    setToggles(t.data ?? null)
    setDataLoading(false)
  }

  // ── ADD ────────────────────────────────────────────────────

  async function addBuilding() {
    setSaving(true)
    await supabase.from('buildings').insert({
      school_id: user?.school?.id,
      name: buildingName,
      building_type: buildingType,
      x: Math.random() * 60 + 10,
      y: Math.random() * 60 + 10,
      width: 14,
      height: 10,
      color: '#4A90D9',
      roof_color: '#2C5F8A',
    })
    setBuildingName('')
    setShowAddBuilding(false)
    setSaving(false)
    loadData()
  }

  async function addDepartment() {
    setSaving(true)
    await supabase.from('departments').insert({
      school_id: user?.school?.id,
      name: deptName,
      short_code: deptCode,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    })
    setDeptName('')
    setDeptCode('')
    setShowAddDept(false)
    setSaving(false)
    loadData()
  }

  async function addClass() {
    setSaving(true)
    const schoolId = user?.school?.id

    // Auto-create a room in the selected building
    let roomId = null
    if (classBuilding) {
      const { data: room } = await supabase.from('rooms').insert({
        school_id: schoolId,
        building_id: classBuilding,
        name: classCode,
        floor: 1,
      }).select().single()
      roomId = room?.id ?? null
    }

    await supabase.from('classes').insert({
      school_id: schoolId,
      name: className,
      code: classCode,
      level: classLevel,
      department_id: classDept || null,
      room_id: roomId,
    })

    setClassName('')
    setClassCode('')
    setClassLevel('')
    setClassDept('')
    setClassBuilding('')
    setShowAddClass(false)
    setSaving(false)
    loadData()
  }

  // ── DELETE ─────────────────────────────────────────────────

  async function deleteBuilding(id: string) {
    if (!confirm('Delete this building? This cannot be undone.')) return
    await supabase.from('buildings').delete().eq('id', id)
    loadData()
  }

  async function deleteDepartment(id: string) {
    if (!confirm('Delete this department?')) return
    await supabase.from('departments').delete().eq('id', id)
    loadData()
  }

  async function deleteClass(id: string) {
    if (!confirm('Delete this class?')) return
    await supabase.from('classes').delete().eq('id', id)
    loadData()
  }

  // ── TOGGLES ────────────────────────────────────────────────

  async function updateToggle(key: string, value: boolean) {
    setToggles((prev: any) => ({ ...prev, [key]: value }))
    await supabase
      .from('feature_toggles')
      .update({ [key]: value })
      .eq('school_id', user?.school?.id)
  }

  // ── HELPERS ────────────────────────────────────────────────

  const buildingStatusColor: Record<string, string> = {
    normal: 'bg-zinc-700 text-zinc-300',
    cancelled: 'bg-red-500/20 text-red-400',
    confirmed: 'bg-blue-500/20 text-blue-400',
    delayed: 'bg-yellow-500/20 text-yellow-400',
    pending: 'bg-orange-500/20 text-orange-400',
    warning: 'bg-red-600/20 text-red-500',
    broadcast: 'bg-purple-500/20 text-purple-400',
  }

  const buildingStatusEmoji: Record<string, string> = {
    normal: '🟢', cancelled: '🔥', confirmed: '🌧️',
    delayed: '⏱️', pending: '⚠️', warning: '🚨', broadcast: '📣',
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 text-xl font-bold animate-pulse">Loading Campus...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏫</span>
              <h1 className="text-lg font-black tracking-tight">
                {user?.school?.name ?? 'Campus Admin'}
              </h1>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">School Admin Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">
              {user?.school?.plan_status}
            </p>
            <p className="text-zinc-500 text-xs">{user?.profile?.full_name}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        {(['overview', 'buildings', 'departments', 'classes', 'reps', 'settings'] as Tab[]).map((tab) => (
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

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Buildings', value: buildings.length, icon: '🏢' },
                { label: 'Departments', value: departments.length, icon: '📚' },
                { label: 'Classes', value: classes.length, icon: '📖' },
                { label: 'Active Now', value: buildings.filter(b => b.status !== 'normal').length, icon: '🔥' },
              ].map((stat) => (
                <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="text-zinc-500 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <h3 className="font-bold text-sm mb-3 text-zinc-400 uppercase tracking-wider">
                Live Campus Status
              </h3>
              {buildings.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-4">
                  No buildings yet. Go to Buildings tab.
                </p>
              ) : (
                <div className="space-y-2">
                  {buildings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span>{buildingStatusEmoji[b.status] ?? '🟢'}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{b.name}</p>
                          <p className="text-zinc-500 text-xs capitalize">{b.building_type.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold capitalize ${buildingStatusColor[b.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BUILDINGS */}
        {activeTab === 'buildings' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-white">Campus Buildings</h2>
              <button
                onClick={() => setShowAddBuilding(true)}
                className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                + Add Building
              </button>
            </div>

            {buildings.length === 0 ? (
              <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-zinc-400 font-medium">No buildings yet</p>
              </div>
            ) : (
              buildings.map((b) => (
                <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                        style={{ backgroundColor: b.color + '33', color: b.color }}
                      >
                        {b.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold">{b.name}</p>
                        <p className="text-zinc-500 text-xs capitalize">
                          {b.building_type.replace('_', ' ')} · {b.floor_count} floor{b.floor_count > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold capitalize ${buildingStatusColor[b.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                        {buildingStatusEmoji[b.status]} {b.status}
                      </span>
                      <button
                        onClick={() => deleteBuilding(b.id)}
                        className="text-zinc-600 hover:text-red-400 text-lg transition-colors ml-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {showAddBuilding && (
              <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-white font-bold text-lg mb-4">Add Building</h3>
                  <div className="space-y-3">
                    <input
                      value={buildingName}
                      onChange={(e) => setBuildingName(e.target.value)}
                      placeholder="Building name e.g. LT2"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <select
                      value={buildingType}
                      onChange={(e) => setBuildingType(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="lecture_hall">Lecture Hall</option>
                      <option value="lab">Laboratory</option>
                      <option value="library">Library</option>
                      <option value="admin">Admin Block</option>
                      <option value="hostel">Hostel</option>
                      <option value="canteen">Canteen</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowAddBuilding(false)}
                        className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-3 text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addBuilding}
                        disabled={!buildingName || saving}
                        className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold"
                      >
                        {saving ? 'Saving...' : 'Add Building'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-white">Departments</h2>
              <button
                onClick={() => setShowAddDept(true)}
                className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                + Add Dept
              </button>
            </div>

            {departments.length === 0 ? (
              <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-zinc-400 font-medium">No departments yet</p>
              </div>
            ) : (
              departments.map((d) => (
                <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                      style={{ backgroundColor: d.color + '33', color: d.color }}
                    >
                      {d.short_code ?? d.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-bold">{d.name}</p>
                      <p className="text-zinc-500 text-xs">
                        {classes.filter(c => c.department_id === d.id).length} classes
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDepartment(d.id)}
                    className="text-zinc-600 hover:text-red-400 text-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}

            {showAddDept && (
              <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-white font-bold text-lg mb-4">Add Department</h3>
                  <div className="space-y-3">
                    <input
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="Department name e.g. Science & Maths"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <input
                      value={deptCode}
                      onChange={(e) => setDeptCode(e.target.value)}
                      placeholder="Short code e.g. SCI"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowAddDept(false)}
                        className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-3 text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addDepartment}
                        disabled={!deptName || saving}
                        className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold"
                      >
                        {saving ? 'Saving...' : 'Add Department'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLASSES */}
        {activeTab === 'classes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-white">Classes</h2>
              <button
                onClick={() => setShowAddClass(true)}
                className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                + Add Class
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📖</div>
                <p className="text-zinc-400 font-medium">No classes yet</p>
              </div>
            ) : (
              classes.map((c) => (
                <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-500/20 text-orange-400 w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black">
                      {c.code}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{c.name}</p>
                      <p className="text-zinc-500 text-xs">
                        {departments.find(d => d.id === c.department_id)?.name ?? 'No dept'}
                        {c.level ? ` · Level ${c.level}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${c.active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => deleteClass(c.id)}
                      className="text-zinc-600 hover:text-red-400 text-lg transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}

            {showAddClass && (
              <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-white font-bold text-lg mb-4">Add Class</h3>
                  <div className="space-y-3">
                    <input
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value)}
                      placeholder="Class code e.g. MAT203"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <input
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="Class name e.g. Calculus II"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <input
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      placeholder="Level e.g. 200, HND1"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <select
                      value={classDept}
                      onChange={(e) => setClassDept(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Select department (optional)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>

                    {/* Building selector — this is what links class to map */}
                    <select
                      value={classBuilding}
                      onChange={(e) => setClassBuilding(e.target.value)}
                      className="w-full bg-zinc-800 border border-orange-500/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="">⚠️ Select building (required for map)</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <p className="text-zinc-600 text-xs -mt-1 px-1">
                      This links the class to a building so it burns on the map when cancelled
                    </p>

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setShowAddClass(false)}
                        className="flex-1 bg-zinc-800 text-zinc-400 rounded-xl py-3 text-sm font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addClass}
                        disabled={!className || !classCode || !classBuilding || saving}
                        className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold"
                      >
                        {saving ? 'Saving...' : 'Add Class'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPS */}
        {activeTab === 'reps' && (
          <div className="space-y-3">
            <h2 className="font-bold text-white mb-2">Course Reps</h2>
            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">👤</div>
              <p className="text-zinc-400 font-medium">Coming next</p>
              <p className="text-zinc-600 text-sm mt-1">
                Add buildings, departments and classes first
              </p>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="font-bold text-white mb-2">School Settings</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">School Name</p>
                <p className="text-white font-bold">{user?.school?.name}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Plan</p>
                <p className="text-orange-400 font-bold capitalize">{user?.school?.plan_status}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Notification Style</p>
                <p className="text-white font-bold capitalize">{user?.school?.notification_style}</p>
              </div>
            </div>

            {/* WORKING Feature Toggles */}
            {toggles && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">Feature Toggles</h3>
                <div className="space-y-4">
                  {[
                    { label: '🔥 Fire Mode', key: 'fire_mode_enabled' },
                    { label: '🌧️ Rain Mode', key: 'rain_mode_enabled' },
                    { label: '📺 Campus TV', key: 'campus_tv_enabled' },
                    { label: '⚠️ Anticipation Mode', key: 'anticipation_mode_enabled' },
                    { label: '😂 Reactions', key: 'reactions_enabled' },
                    { label: '🏆 Leaderboard', key: 'leaderboard_enabled' },
                    { label: '🔊 Speaker Mode', key: 'speaker_mode_enabled' },
                    { label: '🎙️ Voice Broadcasts', key: 'voice_broadcast_enabled' },
                    { label: '🦸 Hero Roles', key: 'hero_roles_enabled' },
                  ].map((toggle) => (
                    <div key={toggle.key} className="flex items-center justify-between">
                      <span className="text-zinc-300 text-sm">{toggle.label}</span>
                      <button
                        onClick={() => updateToggle(toggle.key, !toggles[toggle.key])}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                          toggles[toggle.key] ? 'bg-orange-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                          toggles[toggle.key] ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-zinc-600 text-xs mt-4">
                  Changes save instantly to the database
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 px-6 py-3">
        <div className="flex justify-around max-w-md mx-auto">
          {[
            { icon: '🏠', label: 'Overview', tab: 'overview' },
            { icon: '🏢', label: 'Buildings', tab: 'buildings' },
            { icon: '📚', label: 'Depts', tab: 'departments' },
            { icon: '📖', label: 'Classes', tab: 'classes' },
            { icon: '⚙️', label: 'Settings', tab: 'settings' },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab as Tab)}
              className={`flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === item.tab ? 'text-orange-400' : 'text-zinc-600 hover:text-zinc-400'
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