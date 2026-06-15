import { create } from 'zustand'
import { AuthUser } from '@/types'

interface AuthStore {
  user: AuthUser | null
  loading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
  isSuper: () => boolean
  isSchoolAdmin: () => boolean
  isCommander: () => boolean
  isDeptGeneral: () => boolean
  isCourseRep: () => boolean
  isStudent: () => boolean
  canBroadcast: () => boolean
  hasPremium: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ user: null, loading: false }),

  isSuper: () => get().user?.role?.role_type === 'super_admin',
  isSchoolAdmin: () => get().user?.role?.role_type === 'school_admin',
  isCommander: () => get().user?.role?.role_type === 'commander',
  isDeptGeneral: () => get().user?.role?.role_type === 'department_general',
  isCourseRep: () => get().user?.role?.role_type === 'course_rep',
  isStudent: () => get().user?.role?.role_type === 'student',

  canBroadcast: () => {
    const role = get().user?.role?.role_type
    return ['super_admin', 'school_admin', 'commander', 'department_general', 'course_rep']
      .includes(role ?? '')
  },

  hasPremium: () => {
    const plan = get().user?.school?.plan_status
    return plan === 'premium' || plan === 'trial'
  }
}))