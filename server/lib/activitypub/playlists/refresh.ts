import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { PeerTubeRequestError } from '@server/helpers/requests'
import { JobQueue } from '@server/lib/job-queue'
import { MVideoPlaylist, MVideoPlaylistOwner } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'
import { createOrUpdateVideoPlaylist } from './create-update'
import { fetchRemoteVideoPlaylist } from './shared'

function scheduleRefreshIfNeeded (playlist: MVideoPlaylist) {
  if (!playlist.isOutdated()) return

  JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'video-playlist', url: playlist.url } })
}

async function refreshVideoPlaylistIfNeeded (videoPlaylist: MVideoPlaylistOwner): Promise<MVideoPlaylistOwner> {
  if (!videoPlaylist.isOutdated()) return videoPlaylist

  const lTags = loggerTagsFactory('ap', 'video-playlist', 'refresh', videoPlaylist.uuid, videoPlaylist.url)

  logger.info('Refreshing playlist %s.', videoPlaylist.url, lTags())

  try {
    const { playlistObject } = await fetchRemoteVideoPlaylist(videoPlaylist.url)

    if (playlistObject === undefined) {
      logger.warn('Cannot refresh remote playlist %s: invalid body.', videoPlaylist.url, lTags())

      await videoPlaylist.setAsRefreshed()
      return videoPlaylist
    }

    await createOrUpdateVideoPlaylist(playlistObject)

    return videoPlaylist
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Cannot refresh not existing playlist %s. Deleting it.', videoPlaylist.url, lTags())

      await videoPlaylist.destroy()
      return undefined
    }

    logger.warn('Cannot refresh video playlist %s.', videoPlaylist.url, { err, ...lTags() })

    await videoPlaylist.setAsRefreshed()
    return videoPlaylist
  }
}

export {
  scheduleRefreshIfNeeded,
  refreshVideoPlaylistIfNeeded
}
