export type PlanStatus = 'free' | 'premium' | 'trial' | 'suspended' | 'custom'

export type RoleType =
  | 'super_admin'
  | 'school_admin'
  | 'commander'
  | 'department_general'
  | 'course_rep'
  | 'student'

export type AnnouncementStatus =
  | 'pending'
  | 'cancelled'
  | 'confirmed'
  | 'delayed'
  | 'room_changed'
  | 'broadcast'
  | 'warning'

export type BuildingStatus =
  | 'normal'
  | 'pending'
  | 'cancelled'
  | 'confirmed'
  | 'delayed'
  | 'warning'
  | 'broadcast'

export type TargetType = 'school' | 'department' | 'building' | 'class'

export interface School {
  id: string
  name: string
  slug: string
  logo_url: string | null
  campus_image_url: string | null
  map_mode: 'photo_pin' | 'schematic_2d' | 'schematic_3d'
  map_data: any
  plan_status: PlanStatus
  plan_price_ghs: number
  plan_expires_at: string | null
  notification_style: 'dramatic' | 'standard'
  school_color: string
  school_tagline: string | null
  active: boolean
  created_at: string
}

export interface User {
  id: string
  school_id: string | null
  full_name: string
  avatar_url: string | null
  phone: string | null
  created_at: string
}

export interface Role {
  id: string
  school_id: string
  user_id: string
  role_type: RoleType
  hero_title: string | null
  hero_avatar_url: string | null
  hero_color: string | null
  department_id: string | null
  is_active: boolean
  assigned_at: string
}

export interface Building {
  id: string
  school_id: string
  name: string
  short_name: string | null
  building_type: string
  x: number
  y: number
  width: number
  height: number
  floor_count: number
  color: string
  roof_color: string
  position_3d: any
  status: BuildingStatus
  status_set_at: string | null
  created_at: string
}

export interface Department {
  id: string
  school_id: string
  name: string
  short_code: string | null
  color: string
  icon: string | null
  created_at: string
}

export interface Class {
  id: string
  school_id: string
  department_id: string | null
  room_id: string | null
  code: string
  name: string
  level: string | null
  active: boolean
  created_at: string
}

export interface Announcement {
  id: string
  school_id: string
  created_by: string
  creator_role: RoleType
  target_type: TargetType
  target_id: string
  status: AnnouncementStatus
  message: string | null
  voice_url: string | null
  voice_expires_at: string | null
  voice_expired: boolean
  is_pinned: boolean
  view_count: number
  created_at: string
}

export interface Reaction {
  id: string
  school_id: string
  announcement_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface FeatureToggles {
  school_id: string
  schematic_3d_map_enabled: boolean
  fire_mode_enabled: boolean
  rain_mode_enabled: boolean
  custom_sounds_enabled: boolean
  speaker_mode_enabled: boolean
  voice_broadcast_enabled: boolean
  anticipation_mode_enabled: boolean
  campus_tv_enabled: boolean
  reactions_enabled: boolean
  leaderboard_enabled: boolean
  hero_roles_enabled: boolean
  analytics_enabled: boolean
}

export interface AuthUser {
  id: string
  email: string | null
  profile: User | null
  role: Role | null
  school: School | null
  features: FeatureToggles | null
}