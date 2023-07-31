import { WEBSERVER } from '@server/initializers/constants.js'

function handleToNameAndHost (handle: string) {
  let [ name, host ] = handle.split('@')
  if (host === WEBSERVER.HOST) host = null

  return { name, host, handle }
}

function handlesToNameAndHost (handles: string[]) {
  return handles.map(h => handleToNameAndHost(h))
}

export {
  handleToNameAndHost,
  handlesToNameAndHost
}
