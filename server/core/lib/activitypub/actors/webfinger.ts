import WebFinger from 'webfinger.js'
import { WebFingerData } from '@peertube/peertube-models'
import { isProdInstance } from '@peertube/peertube-node-utils'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { REQUEST_TIMEOUTS, WEBSERVER } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorFull } from '@server/types/models/index.js'

const webfinger = new WebFinger({
  webfist_fallback: false,
  tls_only: isProdInstance(),
  uri_fallback: false,
  request_timeout: REQUEST_TIMEOUTS.DEFAULT
})

async function loadActorUrlOrGetFromWebfinger (uriArg: string) {
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

async function getUrlFromWebfinger (uri: string) {
  const webfingerData: WebFingerData = await webfingerLookup(uri)
  return getLinkOrThrow(webfingerData)
}

// ---------------------------------------------------------------------------

export {
  getUrlFromWebfinger,
  loadActorUrlOrGetFromWebfinger
}

// ---------------------------------------------------------------------------

function getLinkOrThrow (webfingerData: WebFingerData) {
  if (Array.isArray(webfingerData.links) === false) throw new Error('WebFinger links is not an array.')

  const selfLink = webfingerData.links.find(l => l.rel === 'self')
  if (selfLink === undefined || isActivityPubUrlValid(selfLink.href) === false) {
    throw new Error('Cannot find self link or href is not a valid URL.')
  }

  return selfLink.href
}

function webfingerLookup (nameWithHost: string) {
  return new Promise<WebFingerData>((res, rej) => {
    webfinger.lookup(nameWithHost, (err, p) => {
      if (err) return rej(err)

      return res(p.object)
    })
  })
}
