import { buildAspectRatio } from '@peertube/peertube-core-utils'
import { getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import { VideoStudioEditionPayload, VideoStudioTask, VideoStudioTaskPayload } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { createTorrentAndSetInfoHashFromPath } from '@server/helpers/webtorrent.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { MUser, MVideoFile, MVideoFullLight, MVideoWithAllFiles, MVideoWithFile } from '@server/types/models/index.js'
import { move, remove } from 'fs-extra/esm'
import { join } from 'path'
import { JobQueue } from './job-queue/index.js'
import { VideoStudioTranscodingJobHandler } from './runners/index.js'
import { getTranscodingJobPriority } from './transcoding/transcoding-priority.js'
import { createTranscriptionTaskIfNeeded } from './video-captions.js'
import { buildNewFile, removeHLSPlaylist, removeWebVideoFile } from './video-file.js'
import { buildStoryboardJobIfNeeded } from './video-jobs.js'
import { VideoPathManager } from './video-path-manager.js'

const lTags = loggerTagsFactory('video-studio')

export function buildTaskFileFieldname (indice: number, fieldName = 'file') {
  return `tasks[${indice}][options][${fieldName}]`
}

export function getTaskFileFromReq (files: Express.Multer.File[], indice: number, fieldName = 'file') {
  return files.find(f => f.fieldname === buildTaskFileFieldname(indice, fieldName))
}

export function getStudioTaskFilePath (filename: string) {
  return join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, filename)
}

export async function safeCleanupStudioTMPFiles (tasks: VideoStudioTaskPayload[]) {
  logger.info('Removing TMP studio task files', { tasks, ...lTags() })

  for (const task of tasks) {
    try {
      if (task.name === 'add-intro' || task.name === 'add-outro') {
        await remove(task.options.file)
      } else if (task.name === 'add-watermark') {
        await remove(task.options.file)
      }
    } catch (err) {
      logger.error('Cannot remove studio file', { err })
    }
  }
}

// ---------------------------------------------------------------------------

export async function approximateIntroOutroAdditionalSize (
  video: MVideoFullLight,
  tasks: VideoStudioTask[],
  fileFinder: (i: number) => string
) {
  let additionalDuration = 0

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (task.name !== 'add-intro' && task.name !== 'add-outro') continue

    const filePath = fileFinder(i)
    additionalDuration += await getVideoStreamDuration(filePath)
  }

  return (video.getMaxQualityBytes() / video.duration) * additionalDuration
}

// ---------------------------------------------------------------------------

export async function createVideoStudioJob (options: {
  video: MVideoWithFile
  user: MUser
  payload: VideoStudioEditionPayload
}) {
  const { video, user, payload } = options

  const priority = await getTranscodingJobPriority({ user, type: 'studio', fallback: 0 })

  if (CONFIG.VIDEO_STUDIO.REMOTE_RUNNERS.ENABLED) {
    await new VideoStudioTranscodingJobHandler().create({ video, tasks: payload.tasks, priority })
    return
  }

  await JobQueue.Instance.createJob({ type: 'video-studio-edition', payload, priority })
}

export async function onVideoStudioEnded (options: {
  editionResultPath: string
  tasks: VideoStudioTaskPayload[]
  video: MVideoFullLight
}) {
  const { video, tasks, editionResultPath } = options

  const newFile = await buildNewFile({ path: editionResultPath, mode: 'web-video' })
  newFile.videoId = video.id

  const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, newFile)
  await move(editionResultPath, outputPath)

  await safeCleanupStudioTMPFiles(tasks)

  await createTorrentAndSetInfoHashFromPath(video, newFile, outputPath)
  await removeAllFiles(video, newFile)

  await newFile.save()

  video.duration = await getVideoStreamDuration(outputPath)
  video.aspectRatio = buildAspectRatio({ width: newFile.width, height: newFile.height })
  await video.save()

  await JobQueue.Instance.createSequentialJobFlow(
    buildStoryboardJobIfNeeded({ video, federate: false }),

    {
      type: 'federate-video' as 'federate-video',
      payload: {
        videoUUID: video.uuid,
        isNewVideoForFederation: false
      }
    },

    {
      type: 'transcoding-job-builder' as 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        optimizeJob: {
          isNewVideo: false
        }
      }
    }
  )

  if (video.language && CONFIG.VIDEO_TRANSCRIPTION.ENABLED) {
    const caption = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, video.language)

    if (caption?.automaticallyGenerated) {
      await createTranscriptionTaskIfNeeded(video)
    }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function removeAllFiles (video: MVideoWithAllFiles, webVideoFileException: MVideoFile) {
  await removeHLSPlaylist(video)

  for (const file of video.VideoFiles) {
    if (file.id === webVideoFileException.id) continue

    await removeWebVideoFile(video, file.id)
  }
}
