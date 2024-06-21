import { RefreshPayload } from '@peertube/peertube-models'
import { refreshVideoPlaylistIfNeeded } from '@server/lib/activitypub/playlists/index.js'
import { refreshVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { loadVideoByUrl, VideoLoadByUrlType } from '@server/lib/model-loaders/index.js'
import { Job } from 'bullmq'
import { logger } from '../../../helpers/logger.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { VideoPlaylistModel } from '../../../models/video/video-playlist.js'
import { refreshActorIfNeeded } from '../../activitypub/actors/index.js'

async function refreshAPObject (job: Job) {
  const payload = job.data as RefreshPayload

  logger.info('Processing AP refresher in job %s for %s.', job.id, payload.url)

  if (payload.type === 'video') return refreshVideo(payload.url)
  if (payload.type === 'video-playlist') return refreshVideoPlaylist(payload.url)
  if (payload.type === 'actor') return refreshActor(payload.url)
}

// ---------------------------------------------------------------------------

export {
  refreshAPObject
}

// ---------------------------------------------------------------------------

async function refreshVideo (videoUrl: string) {
  const fetchType = 'all'
  const syncParam = { rates: true, shares: true, comments: true }

  const videoFromDatabase = await loadVideoByUrl(videoUrl, fetchType)
  if (videoFromDatabase) {
    const refreshOptions = {
      video: videoFromDatabase,
      fetchedType: fetchType as VideoLoadByUrlType,
      syncParam
    }

    await refreshVideoIfNeeded(refreshOptions)
  }
}

async function refreshActor (actorUrl: string) {
  const fetchType = 'all'
  const actor = await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorUrl)

  if (actor) {
    await refreshActorIfNeeded({ actor, fetchedType: fetchType })
  }
}

async function refreshVideoPlaylist (playlistUrl: string) {
  const playlist = await VideoPlaylistModel.loadByUrlAndPopulateAccount(playlistUrl)

  if (playlist) {
    await refreshVideoPlaylistIfNeeded(playlist)
  }
}
