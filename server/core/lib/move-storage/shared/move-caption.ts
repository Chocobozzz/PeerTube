import { createLogger } from '@server/helpers/logger.js'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/federate.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { MStreamingPlaylistVideoUUID, MVideoCaption } from '@server/types/models/index.js'

const logger = createLogger()

export async function moveCaptionToStorage (options: {
  captionId: number

  moveCaptionFiles: (captions: MVideoCaption[], hls: MStreamingPlaylistVideoUUID) => Promise<void>
}) {
  const {
    captionId,
    moveCaptionFiles
  } = options

  const caption = await VideoCaptionModel.loadWithVideo(captionId)

  if (!caption) {
    logger.info(`Can't process caption ${captionId}, caption does not exist anymore.`)
    return
  }

  await logger.withContext([ caption.Video.uuid ], async () => {
    const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(caption.Video.uuid)

    const hls = await VideoStreamingPlaylistModel.loadHLSByVideoWithVideo(caption.videoId)

    try {
      await moveCaptionFiles([ caption ], hls)

      scheduleVideoFederation({ video: caption.Video })
    } finally {
      fileMutexReleaser()
    }
  })
}
