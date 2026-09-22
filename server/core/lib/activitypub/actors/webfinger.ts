import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { doJSONRequest } from '@server/helpers/requests.js'
import { REMOTE_SCHEME, REQUEST_TIMEOUTS, WEBSERVER } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorFull } from '@server/types/models/index.js'

type WebFingerJRD = {
  links?: { rel?: string, href?: string }[]
}

export async function loadActorUrlOrGetFromWebfinger (uriArg: string) {
  // Handle strings like @toto@example.com
  const uri = uriArg.startsWith('@') ? uriArg.slice(1) : uriArg

  const [ name, host ] = uri.split('@')
  let actor: MActorFull

  if (!host || host === WEBSERVER.HOST) {
    actor = await ActorModel.loadLocalByName(name)
  } else {
    actor = await ActorModel.loadByNameAndHost(name, host)
  }

  if (actor) return actor.url

  return getUrlFromWebfinger(uri)
}

export async function getUrlFromWebfinger (uri: string) {
  const [ name, host ] = uri.split('@')
  if (!name || !host) throw new Error(`Invalid webfinger address "${uri}"`)

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
