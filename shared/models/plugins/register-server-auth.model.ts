import { UserRole } from '@shared/models'

export type RegisterServerAuthOptions = RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions

export interface RegisterServerAuthPassOptions {
  // Authentication name (a plugin can register multiple auth strategies)
  authName: string

  onLogout?: Function

  // Weight of this authentication so PeerTube tries the auth methods in DESC weight order
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
  // Authentication name (a plugin can register multiple auth strategies)
  authName: string

  onLogout?: Function
}

export interface RegisterServerAuthExternalResult {
  onAuth (options: { username: string, email: string }): void
}
