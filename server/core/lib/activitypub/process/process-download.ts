import { ActivityView } from '@peertube/peertube-models'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { getOrCreateAPVideo } from '../videos/index.js'
import { VideoViewerStats } from '@server/lib/views/shared/video-viewer-stats.js'

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

  await VideoViewerStats.add({ video })
}
