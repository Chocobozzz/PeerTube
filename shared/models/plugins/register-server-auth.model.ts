import { UserRole } from '@shared/models'

export type RegisterServerAuthOptions = RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions

export interface RegisterServerAuthPassOptions {
  type: 'id-and-pass'

  onLogout?: Function

  getWeight(): number

  // Used by PeerTube to login a user
  // Returns null if the login failed, or { username, email } on success
  login(body: {
    id: string
    password: string
  }): Promise<{
    username: string
    email: string
    role?: UserRole
    displayName?: string
  } | null>
}

export interface RegisterServerAuthExternalOptions {
  type: 'external'

  onLogout?: Function
}

export interface RegisterServerAuthExternalResult {
  onAuth (options: { username: string, email: string }): void
}
