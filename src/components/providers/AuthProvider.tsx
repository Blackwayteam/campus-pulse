'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { useAuthStore } from '@/store/auth'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, clear } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    // Load user on mount
    getAuthUser().then((user) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const user = await getAuthUser()
          setUser(user)
          setLoading(false)

          // Route based on role
          const role = user?.role?.role_type
          if (role === 'super_admin') router.push('/super-admin')
          else if (role === 'school_admin') router.push('/school-admin')
          else if (role === 'course_rep') router.push('/control-room')
          else router.push('/campus')

        } else if (event === 'SIGNED_OUT') {
          clear()
          router.push('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return <>{children}</>
}