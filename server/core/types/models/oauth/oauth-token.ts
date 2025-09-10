import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MUserAccountUrl } from '../user/user.js'

type Use<K extends keyof OAuthTokenModel, M> = PickWith<OAuthTokenModel, K, M>

// ############################################################################

export type MOAuthToken = Omit<OAuthTokenModel, 'User' | 'OAuthClients'>
export type MOAuthTokenLight = Omit<MOAuthToken, 'lastActivityDate' | 'lastActivityDevice' | 'lastActivityIP'>

export type MOAuthTokenUser =
  & MOAuthTokenLight
  & Use<'User', MUserAccountUrl>
  & { user?: MUserAccountUrl }
