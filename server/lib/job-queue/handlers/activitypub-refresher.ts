import * as Bull from 'bull'
import { refreshVideoPlaylistIfNeeded } from '@server/lib/activitypub/playlists'
import { refreshVideoIfNeeded } from '@server/lib/activitypub/videos'
import { loadVideoByUrl } from '@server/lib/model-loaders'
import { RefreshPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/actor/actor'
import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { refreshActorIfNeeded } from '../../activitypub/actors'

async function refreshAPObject (job: Bull.Job) {
  const payload = job.data as RefreshPayload

  logger.info('Processing AP refresher in job %d for %s.', job.id, payload.url)

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
  const fetchType = 'all' as 'all'
  const syncParam = { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true }

  const videoFromDatabase = await loadVideoByUrl(videoUrl, fetchType)
  if (videoFromDatabase) {
    const refreshOptions = {
      video: videoFromDatabase,
      fetchedType: fetchType,
      syncParam
    }

    await refreshVideoIfNeeded(refreshOptions)
  }
}

async function refreshActor (actorUrl: string) {
  const fetchType = 'all' as 'all'
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
