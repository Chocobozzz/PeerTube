import { RegisterClientHookOptions } from '@shared/models/plugins/register-client-hook.model'

export type RegisterClientOptions = {
  registerHook: (options: RegisterClientHookOptions) => void

  peertubeHelpers: {
    getBaseStaticRoute: () => string
  }
}
