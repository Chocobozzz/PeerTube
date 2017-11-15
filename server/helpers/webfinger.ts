import * as WebFinger from 'webfinger.js'

import { isTestInstance } from './core-utils'
import { isActivityPubUrlValid } from './custom-validators'
import { WebFingerData } from '../../shared'
import { fetchRemoteAccountAndCreateServer } from './activitypub'

const webfinger = new WebFinger({
  webfist_fallback: false,
  tls_only: isTestInstance(),
  uri_fallback: false,
  request_timeout: 3000
})

async function getAccountFromWebfinger (nameWithHost: string) {
  const webfingerData: WebFingerData = await webfingerLookup(nameWithHost)

  if (Array.isArray(webfingerData.links) === false) throw new Error('WebFinger links is not an array.')

  const selfLink = webfingerData.links.find(l => l.rel === 'self')
  if (selfLink === undefined || isActivityPubUrlValid(selfLink.href) === false) {
    throw new Error('Cannot find self link or href is not a valid URL.')
  }

  const res = await fetchRemoteAccountAndCreateServer(selfLink.href)
  if (res === undefined) throw new Error('Cannot fetch and create server of remote account ' + selfLink.href)

  return res.account
}

// ---------------------------------------------------------------------------

export {
  getAccountFromWebfinger
}

// ---------------------------------------------------------------------------

function webfingerLookup (nameWithHost: string) {
  return new Promise<WebFingerData>((res, rej) => {
    webfinger.lookup(nameWithHost, (err, p) => {
      if (err) return rej(err)

      return res(p.object)
    })
  })
}
