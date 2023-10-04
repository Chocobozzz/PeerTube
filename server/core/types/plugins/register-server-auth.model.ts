import express from 'express'
import { UserAdminFlagType, UserRoleType } from '@peertube/peertube-models'
import { MOAuthToken, MUser } from '../models/index.js'

export type RegisterServerAuthOptions = RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions

export type AuthenticatedResultUpdaterFieldName = 'displayName' | 'role' | 'adminFlags' | 'videoQuota' | 'videoQuotaDaily'

export interface RegisterServerAuthenticatedResult {
  // Update the user profile if it already exists
  // Default behaviour is no update
  // Introduced in PeerTube >= 5.1
  userUpdater?: <T> (options: {
    fieldName: AuthenticatedResultUpdaterFieldName
    currentValue: T
    newValue: T
  }) => T

  username: string
  email: string
  role?: UserRoleType
  displayName?: string

  // PeerTube >= 5.1
  adminFlags?: UserAdminFlagType

  // PeerTube >= 5.1
  videoQuota?: number
  // PeerTube >= 5.1
  videoQuotaDaily?: number
}

export interface RegisterServerExternalAuthenticatedResult extends RegisterServerAuthenticatedResult {
  req: express.Request
  res: express.Response
}

interface RegisterServerAuthBase {
  // Authentication name (a plugin can register multiple auth strategies)
  authName: string

  // Called by PeerTube when a user from your plugin logged out
  // Returns a redirectUrl sent to the client or nothing
  onLogout?(user: MUser, req: express.Request): Promise<string>

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
