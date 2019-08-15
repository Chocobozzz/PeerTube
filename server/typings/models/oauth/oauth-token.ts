import { OAuthTokenModel } from '@server/models/oauth/oauth-token'
import { PickWith } from '@server/typings/utils'
import { MUserAccountUrl } from '@server/typings/models'

export type MOAuthToken = Omit<OAuthTokenModel, 'User' | 'OAuthClients'>

export type MOAuthTokenUser = MOAuthToken &
  PickWith<OAuthTokenModel, 'User', MUserAccountUrl> &
  { user?: MUserAccountUrl }
