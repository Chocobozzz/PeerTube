import { UserRole } from './user-role'

export interface UserCreate {
  username: string
  password: string
  email: string
  videoQuota: number
  role: UserRole
}
