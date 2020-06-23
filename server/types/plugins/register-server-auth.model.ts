import * as express from 'express'
import { UserRole } from '@shared/models'
import { MOAuthToken, MUser } from '../models'

export type RegisterServerAuthOptions = RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions

export interface RegisterServerAuthenticatedResult {
  username: string
  email: string
  role?: UserRole
  displayName?: string
}

export interface RegisterServerExternalAuthenticatedResult extends RegisterServerAuthenticatedResult {
  req: express.Request
  res: express.Response
}

interface RegisterServerAuthBase {
  // Authentication name (a plugin can register multiple auth strategies)
  authName: string

  // Called by PeerTube when a user from your plugin logged out
  onLogout?(user: MUser): void

  // Your plugin can hook PeerTube access/refresh token validity
  // So you can control for your plugin the user session lifetime
  hookTokenValidity?(options: { token: MOAuthToken, type: 'access' | 'refresh' }): Promise<{ valid: boolean }>
}

export interface RegisterServerAuthPassOptions extends RegisterServerAuthBase {
  // Weight of this authentication so PeerTube tries the auth methods in DESC weight order
  getWeight(): number

  // Used by PeerTube to login a user
  // Returns null if the login failed, or { username, email } on success
  login(body: {
    id: string
    password: string
  }): Promise<RegisterServerAuthenticatedResult | null>
}

export interface RegisterServerAuthExternalOptions extends RegisterServerAuthBase {
  // Will be displayed in a block next to the login form
  authDisplayName: () => string

  onAuthRequest: (req: express.Request, res: express.Response) => void
}

export interface RegisterServerAuthExternalResult {
  userAuthenticated (options: RegisterServerExternalAuthenticatedResult): void
}
