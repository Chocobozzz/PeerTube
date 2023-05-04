import { move, remove } from 'fs-extra'
import { join } from 'path'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { createTorrentAndSetInfoHashFromPath } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { UserModel } from '@server/models/user/user'
import { MUser, MVideo, MVideoFile, MVideoFullLight, MVideoWithAllFiles } from '@server/types/models'
import { getVideoStreamDuration } from '@shared/ffmpeg'
import { VideoStudioEditionPayload, VideoStudioTask, VideoStudioTaskPayload } from '@shared/models'
import { federateVideoIfNeeded } from './activitypub/videos'
import { JobQueue } from './job-queue'
import { VideoStudioTranscodingJobHandler } from './runners'
import { createOptimizeOrMergeAudioJobs } from './transcoding/create-transcoding-job'
import { getTranscodingJobPriority } from './transcoding/transcoding-priority'
import { buildNewFile, removeHLSPlaylist, removeWebTorrentFile } from './video-file'
import { VideoPathManager } from './video-path-manager'

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
  logger.info('Removing studio task files', { tasks, ...lTags() })

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

  return (video.getMaxQualityFile().size / video.duration) * additionalDuration
}

// ---------------------------------------------------------------------------

export async function createVideoStudioJob (options: {
  video: MVideo
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
  await video.save()

  await federateVideoIfNeeded(video, false, undefined)

  const user = await UserModel.loadByVideoId(video.id)

  await createOptimizeOrMergeAudioJobs({ video, videoFile: newFile, isNewVideo: false, user, videoFileAlreadyLocked: false })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function removeAllFiles (video: MVideoWithAllFiles, webTorrentFileException: MVideoFile) {
  await removeHLSPlaylist(video)

  for (const file of video.VideoFiles) {
    if (file.id === webTorrentFileException.id) continue

    await removeWebTorrentFile(video, file.id)
  }
}
