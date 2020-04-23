import * as Bull from 'bull'
import * as Bluebird from 'bluebird'
import { logger } from '../../../helpers/logger'
import { doRequest } from '../../../helpers/requests'
import { buildGlobalHeaders, buildSignedRequestOptions, computeBody } from './utils/activitypub-http-utils'
import { BROADCAST_CONCURRENCY, JOB_REQUEST_TIMEOUT } from '../../../initializers/constants'
import { ActorFollowScoreCache } from '../../files-cache'
import { ActivitypubHttpBroadcastPayload } from '@shared/models'

async function processActivityPubHttpBroadcast (job: Bull.Job) {
  logger.info('Processing ActivityPub broadcast in job %d.', job.id)

  const payload = job.data as ActivitypubHttpBroadcastPayload

  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions(payload)

  const options = {
    method: 'POST',
    uri: '',
    json: body,
    httpSignature: httpSignatureOptions,
    timeout: JOB_REQUEST_TIMEOUT,
    headers: buildGlobalHeaders(body)
  }

  const badUrls: string[] = []
  const goodUrls: string[] = []

  await Bluebird.map(payload.uris, uri => {
    return doRequest(Object.assign({}, options, { uri }))
      .then(() => goodUrls.push(uri))
      .catch(() => badUrls.push(uri))
  }, { concurrency: BROADCAST_CONCURRENCY })

  return ActorFollowScoreCache.Instance.updateActorFollowsScore(goodUrls, badUrls)
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpBroadcast
}
