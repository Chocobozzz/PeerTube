import { UserRole } from './user-role.type'

export interface User {
  id: number
  username: string
  email: string
  displayNSFW: boolean
  role: UserRole
  createdAt: Date
}
