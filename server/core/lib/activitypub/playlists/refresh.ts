import { HttpStatusCode } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { PeerTubeRequestError } from '@server/helpers/requests.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { MVideoPlaylist, MVideoPlaylistOwnerDefault } from '@server/types/models/index.js'
import { createOrUpdateVideoPlaylist } from './create-update.js'
import { fetchRemoteVideoPlaylist } from './shared/index.js'

const logger = createLogger('ap', 'playlist', 'refresh')

export function schedulePlaylistRefreshIfNeeded (playlist: MVideoPlaylist) {
  if (!playlist.isOutdated()) return

  JobQueue.Instance.createJobAsync({
    type: 'activitypub-refresher',
    payload: { type: 'video-playlist', url: playlist.url },
    deduplicationId: `refresh-video-playlist-${playlist.url}`
  })
}

export async function refreshVideoPlaylistIfNeeded (videoPlaylist: MVideoPlaylistOwnerDefault): Promise<MVideoPlaylistOwnerDefault> {
  return logger.withContext([ videoPlaylist.uuid, videoPlaylist.url ], async () => {
    if (!videoPlaylist.isOutdated()) {
      logger.debug('Playlist ' + videoPlaylist.url + ' is not outdated, no need to refresh it.')

      return videoPlaylist
    }

    // Inner functions (fetchRemoteVideoPlaylist...) inherit these tags without having to inject them
    logger.info('Refreshing playlist %s.', videoPlaylist.url)

    try {
      const { playlistObject } = await fetchRemoteVideoPlaylist(videoPlaylist.url)

      if (playlistObject === undefined) {
        logger.warn('Cannot refresh remote playlist %s: invalid body.', videoPlaylist.url)

        await videoPlaylist.setAsRefreshed()
        return videoPlaylist
      }

      await createOrUpdateVideoPlaylist({ playlistObject, contextUrl: videoPlaylist.url })

      return videoPlaylist
    } catch (err) {
      const statusCode = (err as PeerTubeRequestError).statusCode

      if (statusCode === HttpStatusCode.NOT_FOUND_404 || statusCode === HttpStatusCode.GONE_410) {
        logger.info('Cannot refresh not existing playlist (404/410 error code) %s. Deleting it.', videoPlaylist.url)

        await videoPlaylist.destroy()
        return undefined
      }

      logger.warn('Cannot refresh video playlist %s.', videoPlaylist.url, { err })

      await videoPlaylist.setAsRefreshed()
      return videoPlaylist
    }
  })
}
