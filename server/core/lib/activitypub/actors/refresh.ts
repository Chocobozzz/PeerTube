import { HttpStatusCode } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CachePromiseFactory } from '@server/helpers/promise-cache.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { ActorLoadByUrlType } from '@server/lib/model-loaders/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorFull, MActorOutdated, MActorUrl } from '@server/types/models/index.js'
import { fetchRemoteActor } from './shared/index.js'
import { APActorUpdater } from './updater.js'
import { getUrlFromWebfinger } from './webfinger.js'

type RefreshResult<T> = Promise<{ actor: T | MActorFull, refreshed: boolean }>

type RefreshOptions<T> = {
  actor: T
  fetchedType: Extract<ActorLoadByUrlType, 'all'> | 'partial'
}

// ---------------------------------------------------------------------------

const promiseCache = new CachePromiseFactory(
  doRefresh,
  (options: RefreshOptions<MActorFull | MActorOutdated>) => options.actor.id + ''
)

export function refreshActorIfNeeded<T extends MActorFull | MActorOutdated> (options: RefreshOptions<T>): RefreshResult<T> {
  const actorArg = options.actor
  if (!actorArg.isOutdated()) return Promise.resolve({ actor: actorArg, refreshed: false })

  return promiseCache.run(options)
}

export function scheduleActorRefreshIfNeeded (actor: MActorOutdated & MActorUrl) {
  if (!actor.isOutdated()) return

  JobQueue.Instance.createJobAsync({
    type: 'activitypub-refresher',
    payload: { type: 'actor', url: actor.url },
    deduplicationId: `refresh-actor-${actor.url}`
  })
}

// ---------------------------------------------------------------------------

async function doRefresh<T extends MActorFull | MActorOutdated> (options: RefreshOptions<T>): RefreshResult<MActorFull> {
  const { actor: actorArg, fetchedType } = options

  // We need more attributes
  const actor = fetchedType === 'all'
    ? actorArg as MActorFull
    : await ActorModel.loadAndPopulateAccountAndChannel(actorArg.id)

  const lTags = loggerTagsFactory('ap', 'actor', 'refresh', actor.url)

  logger.info('Refreshing actor %s.', actor.url, lTags())

  try {
    const actorUrl = await getActorUrl(actor)
    const { actorObject } = await fetchRemoteActor(actorUrl)

    if (actorObject === undefined) {
      logger.info('Cannot fetch remote actor %s in refresh actor.', actorUrl)
      return { actor, refreshed: false }
    }

    const updater = new APActorUpdater(actorObject, actor)
    await updater.update()

    return { refreshed: true, actor }
  } catch (err) {
    const statusCode = (err as PeerTubeRequestError).statusCode

    if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
      logger.info('Deleting actor %s because there is a 404/410 in refresh actor.', actor.url, lTags())

      actor.Account
        ? await actor.Account.destroy()
        : await actor.VideoChannel.destroy()

      return { actor: undefined, refreshed: false }
    }

    logger.info('Cannot refresh actor %s.', actor.url, { err, ...lTags() })
    return { actor, refreshed: false }
  }
}

function getActorUrl (actor: MActorFull) {
  return getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost())
    .catch(err => {
      logger.info('Cannot get actor URL from webfinger, keeping the old one.', { err })
      return actor.url
    })
}
