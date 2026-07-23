import { CONFIG } from '@server/initializers/config.js'
import { MUser } from '@server/types/models/index.js'

export function isRootAuthDisabled (user: Pick<MUser, 'username'>) {
  return CONFIG.USER.DISABLE_ROOT_AUTH === true && user.username === 'root'
}
