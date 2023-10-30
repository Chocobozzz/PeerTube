import { Job } from 'bullmq'
import { ActivitypubHttpBroadcastPayload } from '@peertube/peertube-models'
import { buildGlobalHTTPHeaders, buildSignedRequestOptions, computeBody } from '@server/lib/activitypub/send/http.js'
import { ActorFollowHealthCache } from '@server/lib/actor-follow-health-cache.js'
import { parallelHTTPBroadcastFromWorker, sequentialHTTPBroadcastFromWorker } from '@server/lib/worker/parent-process.js'
import { logger } from '../../../helpers/logger.js'

// Prefer using a worker thread for HTTP requests because on high load we may have to sign many requests, which can be CPU intensive

async function processActivityPubHttpSequentialBroadcast (job: Job<ActivitypubHttpBroadcastPayload>) {
  logger.info('Processing ActivityPub broadcast in job %s.', job.id)

  const requestOptions = await buildRequestOptions(job.data)

  const { badUrls, goodUrls } = await sequentialHTTPBroadcastFromWorker({ uris: job.data.uris, requestOptions })

  return ActorFollowHealthCache.Instance.updateActorFollowsHealth(goodUrls, badUrls)
}

async function processActivityPubParallelHttpBroadcast (job: Job<ActivitypubHttpBroadcastPayload>) {
  logger.info('Processing ActivityPub parallel broadcast in job %s.', job.id)

  const requestOptions = await buildRequestOptions(job.data)

  const { badUrls, goodUrls } = await parallelHTTPBroadcastFromWorker({ uris: job.data.uris, requestOptions })

  return ActorFollowHealthCache.Instance.updateActorFollowsHealth(goodUrls, badUrls)
}

// ---------------------------------------------------------------------------

export {
  processActivityPubHttpSequentialBroadcast,
  processActivityPubParallelHttpBroadcast
}

// ---------------------------------------------------------------------------

async function buildRequestOptions (payload: ActivitypubHttpBroadcastPayload) {
  const body = await computeBody(payload)
  const httpSignatureOptions = await buildSignedRequestOptions({ signatureActorId: payload.signatureActorId, hasPayload: true })

  return {
    method: 'POST' as 'POST',
    json: body,
    httpSignature: httpSignatureOptions,
    headers: await buildGlobalHTTPHeaders(body)
  }
}
