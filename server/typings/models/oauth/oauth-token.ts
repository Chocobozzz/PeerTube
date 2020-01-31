import { OAuthTokenModel } from '@server/models/oauth/oauth-token'
import { PickWith } from '@server/typings/utils'
import { MUserAccountUrl } from '../user/user'

type Use<K extends keyof OAuthTokenModel, M> = PickWith<OAuthTokenModel, K, M>

// ############################################################################

export type MOAuthToken = Omit<OAuthTokenModel, 'User' | 'OAuthClients'>

export type MOAuthTokenUser =
  MOAuthToken &
  Use<'User', MUserAccountUrl> &
  { user?: MUserAccountUrl }
