import { ActivityDownload } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoStatsManager } from '@server/lib/stats/video-stats-manager.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature } from '../../../types/models/index.js'
import { checkUrlsSameHost } from '../url.js'
import { getOrCreateAPVideo } from '../videos/index.js'

const lTags = loggerTagsFactory('ap', 'download')

async function processDownloadActivity (options: APProcessorOptions<ActivityDownload>) {
  const { activity, byActor } = options

  return processCreateDownload(activity, byActor)
}

// ---------------------------------------------------------------------------

export {
  processDownloadActivity
}

// ---------------------------------------------------------------------------

async function processCreateDownload (activity: ActivityDownload, byActor: MActorSignature) {
  const videoObject = activity.object

  const { video } = await getOrCreateAPVideo({
    videoObject,
    fetchType: 'with-blacklist',
    allowRefresh: false
  })

  // An instance can tell us one of its users downloaded one of our videos
  // But for a remote video, only its origin instance broadcasts download activities
  if (!video.isLocal() && !checkUrlsSameHost(byActor.url, video.url)) {
    logger.warn('Ignoring download activity %s of %s that does not come from the origin instance.', activity.id, video.url, lTags())
    return
  }

  await VideoStatsManager.Instance.processRemoteDownload({ video, downloadId: activity.id, byActorUrl: byActor.url })
}
