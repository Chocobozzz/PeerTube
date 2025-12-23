import { isProdInstance } from '@peertube/peertube-node-utils'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { REQUEST_TIMEOUTS, WEBSERVER } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorFull } from '@server/types/models/index.js'
import WebFinger from 'webfinger.js'

// eslint-disable-next-line @typescript-eslint/no-deprecated
const webfinger = new WebFinger({
  tls_only: isProdInstance(),
  uri_fallback: false,
  request_timeout: REQUEST_TIMEOUTS.DEFAULT,
  allow_private_addresses: CONFIG.FEDERATION.PREVENT_SSRF === false
})

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
  const { object } = await webfinger.lookup(uri)

  if (Array.isArray(object.links) === false) throw new Error('WebFinger links is not an array.')

  const selfLink = object.links.find(l => l.rel === 'self')
  if (selfLink === undefined || isActivityPubUrlValid(selfLink.href as string) === false) {
    throw new Error('Cannot find self link or href is not a valid URL.')
  }

  return selfLink.href as string
}
