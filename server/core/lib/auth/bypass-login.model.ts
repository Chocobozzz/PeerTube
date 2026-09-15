import { AuthenticatedResultUpdaterFieldName } from '@server/types/index.js'
import { ExternalUser } from './external-user.model.js'

// Results of the userUpdater function of a plugin
export type UserUpdaterResults = {
  // null if the account did not exist when the results were computed
  userId: number | null

  fields: {
    fieldName: AuthenticatedResultUpdaterFieldName
    currentValue: unknown
    value: unknown
  }[]
}

export type BypassLogin = {
  bypass: boolean
  pluginName: string
  authName?: string
  user: ExternalUser
  userUpdaterResults?: UserUpdaterResults
}
