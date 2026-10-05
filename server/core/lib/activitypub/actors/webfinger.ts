import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { isHostValid } from '@server/helpers/custom-validators/servers.js'
import { doJSONRequest } from '@server/helpers/requests.js'
import { REMOTE_SCHEME, REQUEST_TIMEOUTS, WEBSERVER } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorFull } from '@server/types/models/index.js'

type WebFingerJRD = {
  links?: { rel?: string, href?: string }[]
}

export async function loadActorUrlOrGetFromWebfinger (uriArg: string) {
  const actorUrl = await loadActorUrlFromDB(uriArg)
  if (actorUrl) return actorUrl

  return getUrlFromWebfinger(removeHandlePrefix(uriArg))
}

// Resolve the handle without any outbound request
export async function loadActorUrlFromDB (uriArg: string) {
  const [ name, host ] = removeHandlePrefix(uriArg).split('@')
  let actor: MActorFull

  if (!host || host === WEBSERVER.HOST) {
    actor = await ActorModel.loadLocalByName(name)
  } else {
    actor = await ActorModel.loadByNameAndHost(name, host)
  }

  return actor?.url
}

export async function getUrlFromWebfinger (uri: string) {
  const parts = uri.split('@')
  const [ name, host ] = parts

  if (parts.length !== 2 || !name || !isWebfingerHostValid(host)) throw new Error(`Invalid webfinger address "${uri}"`)

  const url = `${REMOTE_SCHEME.HTTP}://${host}/.well-known/webfinger?resource=${encodeURIComponent('acct:' + uri)}`

  const { body } = await doJSONRequest<WebFingerJRD>(url, {
    timeout: REQUEST_TIMEOUTS.DEFAULT,
    headers: { accept: 'application/jrd+json, application/json' }
  })

  if (Array.isArray(body.links) === false) throw new Error('WebFinger links is not an array.')

  const selfLink = body.links.find(l => l.rel === 'self')
  if (selfLink === undefined || isActivityPubUrlValid(selfLink.href) === false) {
    throw new Error('Cannot find self link or href is not a valid URL.')
  }

  return selfLink.href
}

// ---------------------------------------------------------------------------

function removeHandlePrefix (uri: string) {
  // Handle strings like @toto@example.com
  return uri.startsWith('@')
    ? uri.slice(1)
    : uri
}

function isWebfingerHostValid (host: string) {
  // isHostValid accepts a path/query/fragment, but the host must not change the request path
  return isHostValid(host) && /[/?#\\\s]/.test(host) === false
}
