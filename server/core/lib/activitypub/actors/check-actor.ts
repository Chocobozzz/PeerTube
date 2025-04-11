import { MActorHostOnly } from '@server/types/models/index.js'

export function haveActorsSameRemoteHost (base: MActorHostOnly, other: MActorHostOnly) {
  if (!base.serverId || !other.serverId) return false
  if (base.serverId !== other.serverId) return false

  return true
}
