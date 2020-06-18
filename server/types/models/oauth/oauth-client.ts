import { OAuthClientModel } from '@server/models/oauth/oauth-client'

export type MOAuthClient = Omit<OAuthClientModel, 'OAuthTokens'>
