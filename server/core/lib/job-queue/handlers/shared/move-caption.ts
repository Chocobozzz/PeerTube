import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/federate.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideoUUID, MVideoCaption } from '@server/types/models/index.js'

export async function moveCaptionToStorageJob (options: {
  jobId: string
  captionId: number
  loggerTags: (number | string)[]

  moveCaptionFiles: (captions: MVideoCaption[], hls: MStreamingPlaylistVideoUUID) => Promise<void>
}) {
  const {
    jobId,
    loggerTags,
    captionId,
    moveCaptionFiles
  } = options

  const lTagsBase = loggerTagsFactory(...loggerTags)

  const caption = await VideoCaptionModel.loadWithVideo(captionId)

  if (!caption) {
    logger.info(`Can't process job ${jobId}, caption does not exist anymore.`, lTagsBase())
    return
  }

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(caption.Video.uuid)

  const hls = await VideoStreamingPlaylistModel.loadHLSByVideoWithVideo(caption.videoId)

  try {
    await moveCaptionFiles([ caption ], hls)

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async t => {
        const videoFull = await VideoModel.loadFull(caption.Video.id, t)

        await federateVideoIfNeeded(videoFull, false, t)
      })
    })
  } finally {
    fileMutexReleaser()
  }
}
