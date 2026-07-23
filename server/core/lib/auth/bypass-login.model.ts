import { RegisterServerAuthenticatedResult } from '@server/types/index.js'
import { ExternalUser } from './external-user.model.js'

export type BypassLogin = {
  bypass: boolean
  pluginName: string
  authName?: string
  user: ExternalUser
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
}
