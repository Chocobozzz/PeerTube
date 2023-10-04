import { OAuthClientModel } from '@server/models/oauth/oauth-client.js'

export type MOAuthClient = Omit<OAuthClientModel, 'OAuthTokens'>
