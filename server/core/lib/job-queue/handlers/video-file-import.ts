import { getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { VideoFileImportPayload } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/index.js'
import { buildNewFile, storeNewWebVideoFile } from '@server/lib/video-file.js'
import { buildMoveVideoJob } from '@server/lib/video-jobs.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { createTorrentForFileFromPath } from '@server/lib/webtorrent.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'
import { Job } from 'bullmq'
import { createLogger } from '../../../helpers/logger.js'
import { JobQueue } from '../job-queue.js'

const logger = createLogger()

export async function processVideoFileImport (job: Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %s.', job.id)

  const video = await VideoModel.loadFull(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info(`Do not process job ${job.id}, video does not exist.`)
    return undefined
  }

  return logger.withContext([ video.uuid ], async () => {
    await updateVideoFile(video, payload.filePath)

    if (CONFIG.OBJECT_STORAGE.ENABLED) {
      await JobQueue.Instance.createJob(
        await buildMoveVideoJob({
          type: 'move-to-object-storage',
          video,
          moveVideoState: {
            previousVideoState: video.state
          }
        })
      )
    } else {
      scheduleVideoFederation({ video })
    }

    return video
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function updateVideoFile (video: MVideoFull, inputFilePath: string) {
  const mutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    const { resolution } = await getVideoStreamDimensionsInfo(inputFilePath)
    const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === resolution)

    if (currentVideoFile) {
      // Remove old file and old torrent
      await video.removeWebVideoFile(currentVideoFile)
      // Remove the old video file from the array
      video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile)

      await currentVideoFile.destroy()
    }

    const newVideoFile = await buildNewFile({ mode: 'web-video', path: inputFilePath })
    newVideoFile.videoId = video.id

    const { localPath, cleanup, rollback } = await storeNewWebVideoFile({
      video,
      videoFile: newVideoFile,
      inputPath: inputFilePath,
      keepInput: true
    })

    try {
      const { infoHash, torrentFilename, torrentStorage } = await createTorrentForFileFromPath(video, newVideoFile, localPath)
      newVideoFile.torrentFilename = torrentFilename
      newVideoFile.torrentStorage = torrentStorage
      await newVideoFile.save()

      const infohashModel = await VideoInfohashModel.replaceFileInfohash(newVideoFile.id, infoHash)

      video.VideoFiles.push(Object.assign(newVideoFile, { InfoHash: infohashModel }))

      await cleanup()
    } catch (err) {
      // The file was not saved in database: also remove it from its storage, so it is not left orphaned
      await rollback()
      throw err
    }
  } finally {
    mutexReleaser()
  }
}
