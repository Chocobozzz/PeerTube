import { UserRole } from '@shared/models'
import { MOAuthToken } from '@server/typings/models'

export type RegisterServerAuthOptions = RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions

export interface RegisterServerAuthPassOptions {
  // Authentication name (a plugin can register multiple auth strategies)
  authName: string

  // Called by PeerTube when a user from your plugin logged out
  onLogout?(): void

  // Weight of this authentication so PeerTube tries the auth methods in DESC weight order
  getWeight(): number

  // Your plugin can hook PeerTube access/refresh token validity
  // So you can control for your plugin the user session lifetime
  hookTokenValidity?(options: { token: MOAuthToken, type: 'access' | 'refresh' }): Promise<{ valid: boolean }>

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
