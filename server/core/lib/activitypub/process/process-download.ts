import { ActivityView } from '@peertube/peertube-models'
import { VideoStatsManager } from '@server/lib/stats/video-stats-manager.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { getOrCreateAPVideo } from '../videos/index.js'

async function processDownloadActivity (options: APProcessorOptions<ActivityView>) {
  const { activity } = options

  return processCreateDownload(activity)
}

// ---------------------------------------------------------------------------

export {
  processDownloadActivity
}

// ---------------------------------------------------------------------------

async function processCreateDownload (activity: ActivityView) {
  const videoObject = activity.object

  const { video } = await getOrCreateAPVideo({
    videoObject,
    fetchType: 'only-video-and-blacklist',
    allowRefresh: false
  })

  await VideoStatsManager.Instance.processRemoteDownload({ video })
}
