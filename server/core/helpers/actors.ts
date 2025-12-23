import { ActivityPubActorType } from '@peertube/peertube-models'
import { WEBSERVER } from '@server/initializers/constants.js'

export function handleToNameAndHost (handle: string) {
  let [ name, host ] = handle.split('@')
  if (host === WEBSERVER.HOST) host = null

  return { name, host, handle }
}

export function handlesToNameAndHost (handles: string[]) {
  return handles.map(h => handleToNameAndHost(h))
}

const accountType = new Set([ 'Person', 'Application', 'Service', 'Organization' ])
export function isAccountActor (type: ActivityPubActorType) {
  return accountType.has(type)
}

export function isChannelActor (type: ActivityPubActorType) {
  return type === 'Group'
}
