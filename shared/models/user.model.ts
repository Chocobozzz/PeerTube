export type UserRole = 'admin' | 'user'

export interface User {
  id: number
  username: string
  email: string
  displayNSFW: boolean
  role: UserRole
  createdAt: Date
}
