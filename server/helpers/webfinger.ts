import * as WebFinger from 'webfinger.js'
import { WebFingerData } from '../../shared'
import { fetchRemoteAccount } from '../lib/activitypub/account'

import { isTestInstance } from './core-utils'
import { isActivityPubUrlValid } from './custom-validators'

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

  const account = await fetchRemoteAccount(selfLink.href)
  if (account === undefined) throw new Error('Cannot fetch remote account ' + selfLink.href)

  return account
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
