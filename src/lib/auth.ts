import { supabase } from './supabase'
import { AuthUser } from '@/types'

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    // Get role
    const { data: role } = await supabase
      .from('roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    // Get school
    let school = null
    if (profile.school_id) {
      const { data } = await supabase
        .from('schools')
        .select('*')
        .eq('id', profile.school_id)
        .maybeSingle()
      school = data
    }

    // Get feature toggles
    let features = null
    if (profile.school_id) {
      const { data } = await supabase
        .from('feature_toggles')
        .select('*')
        .eq('school_id', profile.school_id)
        .maybeSingle()
      features = data
    }

    return {
      id: user.id,
      email: user.email ?? null,
      profile,
      role: role ?? null,
      school: school ?? null,
      features: features ?? null,
    }
  } catch (e) {
    console.error('getAuthUser error:', e)
    return null
  }
}