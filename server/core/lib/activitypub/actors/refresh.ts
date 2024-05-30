import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CachePromiseFactory } from '@server/helpers/promise-cache.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { ActorLoadByUrlType } from '@server/lib/model-loaders/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { MActorAccountChannelId, MActorFull } from '@server/types/models/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import { fetchRemoteActor } from './shared/index.js'
import { APActorUpdater } from './updater.js'
import { getUrlFromWebfinger } from './webfinger.js'

type RefreshResult <T> = Promise<{ actor: T | MActorFull, refreshed: boolean }>

type RefreshOptions <T> = {
  actor: T
  fetchedType: ActorLoadByUrlType
}

const promiseCache = new CachePromiseFactory(doRefresh, (options: RefreshOptions<MActorFull | MActorAccountChannelId>) => options.actor.url)

function refreshActorIfNeeded <T extends MActorFull | MActorAccountChannelId> (options: RefreshOptions<T>): RefreshResult <T> {
  const actorArg = options.actor
  if (!actorArg.isOutdated()) return Promise.resolve({ actor: actorArg, refreshed: false })

  return promiseCache.run(options)
}

export {
  refreshActorIfNeeded
}

// ---------------------------------------------------------------------------

async function doRefresh <T extends MActorFull | MActorAccountChannelId> (options: RefreshOptions<T>): RefreshResult <MActorFull> {
  const { actor: actorArg, fetchedType } = options

  // We need more attributes
  const actor = fetchedType === 'all'
    ? actorArg as MActorFull
    : await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url)

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
      logger.warn('Cannot get actor URL from webfinger, keeping the old one.', { err })
      return actor.url
    })
}
