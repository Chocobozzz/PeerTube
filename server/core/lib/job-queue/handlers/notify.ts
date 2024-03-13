import { Job } from 'bullmq'
import { Notifier } from '@server/lib/notifier/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { NotifyPayload } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'

async function processNotify (job: Job) {
  const payload = job.data as NotifyPayload
  logger.info('Processing %s notification in job %s.', payload.action, job.id)

  if (payload.action === 'new-video') return doNotifyNewVideo(payload)
}

// ---------------------------------------------------------------------------

export {
  processNotify
}

// ---------------------------------------------------------------------------

async function doNotifyNewVideo (payload: NotifyPayload & { action: 'new-video' }) {
  const refreshedVideo = await VideoModel.loadFull(payload.videoUUID)
  if (!refreshedVideo) return

  Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(refreshedVideo)
}
