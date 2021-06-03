import { ActorFetchByUrlType } from '@server/helpers/actor'
import { logger } from '@server/helpers/logger'
import { PeerTubeRequestError } from '@server/helpers/requests'
import { getUrlFromWebfinger } from '@server/helpers/webfinger'
import { ActorModel } from '@server/models/actor/actor'
import { MActorAccountChannelId, MActorFull } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'
import { fetchRemoteActor } from './shared'
import { APActorUpdater } from './updater'

async function refreshActorIfNeeded <T extends MActorFull | MActorAccountChannelId> (
  actorArg: T,
  fetchedType: ActorFetchByUrlType
): Promise<{ actor: T | MActorFull, refreshed: boolean }> {
  if (!actorArg.isOutdated()) return { actor: actorArg, refreshed: false }

  // We need more attributes
  const actor = fetchedType === 'all'
    ? actorArg as MActorFull
    : await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url)

  try {
    const actorUrl = await getActorUrl(actor)
    const { actorObject } = await fetchRemoteActor(actorUrl)

    if (actorObject === undefined) {
      logger.warn('Cannot fetch remote actor in refresh actor.')
      return { actor, refreshed: false }
    }

    const updater = new APActorUpdater(actorObject, actor)
    await updater.update()

    return { refreshed: true, actor }
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Deleting actor %s because there is a 404 in refresh actor.', actor.url)

      actor.Account
        ? await actor.Account.destroy()
        : await actor.VideoChannel.destroy()

      return { actor: undefined, refreshed: false }
    }

    logger.warn('Cannot refresh actor %s.', actor.url, { err })
    return { actor, refreshed: false }
  }
}

export {
  refreshActorIfNeeded
}

// ---------------------------------------------------------------------------

function getActorUrl (actor: MActorFull) {
  return getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost())
    .catch(err => {
      logger.warn('Cannot get actor URL from webfinger, keeping the old one.', err)
      return actor.url
    })
}
