import * as WebFinger from 'webfinger.js'

import { isTestInstance } from './core-utils'
import { isActivityPubUrlValid } from './custom-validators'
import { WebFingerData } from '../../shared'
import { fetchRemoteAccountAndCreatePod } from './activitypub'

const webfinger = new WebFinger({
  webfist_fallback: false,
  tls_only: isTestInstance(),
  uri_fallback: false,
  request_timeout: 3000
})

async function getAccountFromWebfinger (url: string) {
  const webfingerData: WebFingerData = await webfingerLookup(url)

  if (Array.isArray(webfingerData.links) === false) return undefined

  const selfLink = webfingerData.links.find(l => l.rel === 'self')
  if (selfLink === undefined || isActivityPubUrlValid(selfLink.href) === false) return undefined

  const { account } = await fetchRemoteAccountAndCreatePod(selfLink.href)

  return account
}

// ---------------------------------------------------------------------------

export {
  getAccountFromWebfinger
}

// ---------------------------------------------------------------------------

function webfingerLookup (url: string) {
  return new Promise<WebFingerData>((res, rej) => {
    webfinger.lookup('nick@silverbucket.net', (err, p) => {
      if (err) return rej(err)

      return p
    })
  })
}
