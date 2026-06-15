import { supabase } from './supabase'
import { AuthUser } from '@/types'

export async function getAuthUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const { data: role } = await supabase
    .from('roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const { data: school } = profile.school_id
    ? await supabase
        .from('schools')
        .select('*')
        .eq('id', profile.school_id)
        .single()
    : { data: null }

  const { data: features } = profile.school_id
    ? await supabase
        .from('feature_toggles')
        .select('*')
        .eq('school_id', profile.school_id)
        .single()
    : { data: null }

  return {
    id: user.id,
    email: user.email ?? null,
    profile,
    role: role ?? null,
    school: school ?? null,
    features: features ?? null
  }
}