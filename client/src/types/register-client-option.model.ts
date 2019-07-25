import { RegisterClientHookOptions } from '@shared/models/plugins/register-client-hook.model'

export type RegisterClientOptions = {
  registerHook: (options: RegisterClientHookOptions) => void

  peertubeHelpers: {
    getBaseStaticRoute: () => string

    getSettings: () => Promise<{ [ name: string ]: string }>
  }
}
