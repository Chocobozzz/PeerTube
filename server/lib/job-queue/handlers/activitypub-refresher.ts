import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { fetchVideoByUrl } from '../../../helpers/video'
import { refreshVideoIfNeeded } from '../../activitypub'

export type RefreshPayload = {
  videoUrl: string
  type: 'video'
}

async function refreshAPObject (job: Bull.Job) {
  const payload = job.data as RefreshPayload
  logger.info('Processing AP refresher in job %d.', job.id)

  if (payload.type === 'video') return refreshAPVideo(payload.videoUrl)
}

// ---------------------------------------------------------------------------

export {
  refreshAPObject
}

// ---------------------------------------------------------------------------

async function refreshAPVideo (videoUrl: string) {
  const fetchType = 'all' as 'all'
  const syncParam = { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true }

  const videoFromDatabase = await fetchVideoByUrl(videoUrl, fetchType)
  if (videoFromDatabase) {
    const refreshOptions = {
      video: videoFromDatabase,
      fetchedType: fetchType,
      syncParam
    }

    await refreshVideoIfNeeded(refreshOptions)
  }
}
