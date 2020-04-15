import { RegisterClientHookOptions } from '@shared/models/plugins/register-client-hook.model'
import { Notifier } from '@app/core'

export type RegisterClientOptions = {
  registerHook: (options: RegisterClientHookOptions) => void

  peertubeHelpers: RegisterClientHelpers
}

export type RegisterClientHelpers = {
  getBaseStaticRoute: () => string

  isLoggedIn: () => boolean

  getSettings: () => Promise<{ [ name: string ]: string }>

  notifier: Notifier

  translate: (toTranslate: string) => Promise<string>
}
