import { ServerHookName } from './server-hook.model.js'

export interface RegisterServerHookOptions {
  target: ServerHookName
  handler: Function
  priority?: number
}
