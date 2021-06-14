import * as Bluebird from 'bluebird'
import * as Bull from 'bull'
import { ActivitypubHttpBroadcastPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { BROADCAST_CONCURRENCY } from '../../../initializers/constants'
import { ActorFollowScoreCache } from '../../files-cache'
import { buildGlobalHeaders, buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'

async function processActivityPubHttpBroadcast (job: Bull.Job) {
  logger.info('Processing ActivityPub broadcast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpBroadcastPayload

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST' as 'POST',
    json: body,
    httpSignature: httpSignatureOptions,
    headers: buildGlobalHeaders(body)
  }

  const badUrls: string[] = []
  const goodUrls: string[] = []

  await Bluebird.map(payload.uris, uri => {
    return doRequest(uri, options)
      .then(() => goodUrls.push(uri))
      .catch(() => badUrls.push(uri))
  }, { concurrency: BROADCAST_CONCURRENCY })

  return ActorFollowScoreCache.Instance.updateActorFollowsScore(goodUrls, badUrls)
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpBroadcast
}
