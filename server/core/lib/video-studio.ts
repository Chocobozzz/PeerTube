import { buildAspectRatio } from '@peertube/peertube-core-utils'
import { getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import {
  hasVideoStudioTaskFile,
  VideoState,
  VideoStudioEditionPayload,
  VideoStudioTask,
  VideoStudioTaskPayload
} from '@peertube/peertube-models'
import { runTransaction } from '@server/helpers/database-utils.js'
import { t } from '@server/helpers/i18n.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildNonDuplicatedFederateVideoJob } from '@server/lib/activitypub/videos/federate.js'
import { createTorrentForFileFromPath } from '@server/lib/webtorrent.js'
import { RunnerJobModel } from '@server/models/runner/runner-job.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUserId, MVideoFull, MVideoWithAllFiles, MVideoWithFile } from '@server/types/models/index.js'
import { move, remove } from 'fs-extra/esm'
import { basename, join } from 'path'
import { JobQueue } from './job-queue/index.js'
import { Notifier } from './notifier/index.js'
import { buildStagingKey, downloadStagingObject, removeStagingObject, storeStagingObject } from './object-storage/staging.js'
import { VideoStudioTranscodingJobHandler } from './runners/index.js'
import { getTranscodingJobPriority } from './transcoding/transcoding-priority.js'
import { regenerateTranscriptionTaskIfNeeded } from './transcription/video-transcription.js'
import { buildNewFile, removeAllWebVideoFilesUnderLock, removeHLSPlaylistUnderLock, storeNewWebVideoFile } from './video-file.js'
import { addRemoteStoryboardJobIfNeeded, buildLocalStoryboardJobIfNeeded } from './video-jobs.js'
import { VideoPathManager } from './video-path-manager.js'
import { buildNameFromVideoName } from './video.js'

const logger = createLogger('studio')

export function buildTaskFileFieldname (indice: number, fieldName = 'file') {
  return `tasks[${indice}][options][${fieldName}]`
}

// Name of the video that receives the result of an edition saved as a new video
export function buildStudioNewVideoName (sourceName: string, language: string) {
  return buildNameFromVideoName(sourceName, videoName => t('{videoName} (Studio Edit)', language, { videoName }))
}

export function getTaskFileFromReq (files: Express.Multer.File[], indice: number, fieldName = 'file') {
  return files.find(f => f.fieldname === buildTaskFileFieldname(indice, fieldName))
}

export function getStudioTaskFilePath (filename: string) {
  return join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, filename)
}

// ---------------------------------------------------------------------------

type StudioTaskFiles = Pick<VideoStudioEditionPayload, 'tasks' | 'taskFilesStaged'>

// Task files are staged in object storage, or kept in the persistent temporary directory without object storage
export async function handleStudioTaskFile (options: {
  file: Express.Multer.File
  staged: boolean
}) {
  const { file, staged } = options
  const filename = basename(file.path)

  if (staged) {
    const key = buildStagingKey('VIDEO_STUDIO', filename)

    await storeStagingObject({ key, inputPath: file.path, contentType: file.mimetype })
    await remove(file.path)

    return key
  }

  const destination = getStudioTaskFilePath(filename)
  await move(file.path, destination)

  return destination
}

// Run `cb` with tasks whose files are on the local disk, downloading them from object storage staging if needed
export async function makeStudioTaskFilesAvailable<T> (payload: StudioTaskFiles, cb: (tasks: VideoStudioTaskPayload[]) => Promise<T>) {
  if (!payload.taskFilesStaged) return cb(payload.tasks)

  const localPaths: string[] = []

  try {
    const tasks: VideoStudioTaskPayload[] = []

    for (const task of payload.tasks) {
      if (!hasVideoStudioTaskFile(task)) {
        tasks.push(task)
        continue
      }

      const destination = join(CONFIG.STORAGE.TMP_DIR, basename(task.options.file))
      localPaths.push(destination)

      await downloadStagingObject({ key: task.options.file, destination })

      tasks.push({ ...task, options: { ...task.options, file: destination } } as VideoStudioTaskPayload)
    }

    return await cb(tasks)
  } finally {
    for (const path of localPaths) {
      await remove(path)
        .catch(err => logger.error('Cannot remove local copy %s of a staged studio task file', path, { err }))
    }
  }
}

export async function safeCleanupStudioTMPFiles (payload: StudioTaskFiles) {
  const files = payload.tasks.filter(hasVideoStudioTaskFile).map(t => t.options.file)
  if (files.length === 0) return

  logger.info('Removing studio task files', { files, staged: payload.taskFilesStaged === true })

  if (payload.taskFilesStaged) {
    for (const file of files) {
      await removeStagingObject(file)
        .catch(err => logger.error('Cannot remove staged studio task file %s', file, { err }))
    }

    return
  }

  // Runner jobs created before object storage was enabled fail if a secondary process completes them
  for (const file of files) {
    await remove(file)
      .catch(err => logger.error('Cannot remove studio task file %s', file, { err }))
  }
}

// ---------------------------------------------------------------------------

export async function approximateIntroOutroAdditionalSize (
  video: MVideoFull,
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
  user: MUserId
  payload: VideoStudioEditionPayload
}) {
  const { video, user, payload } = options

  const priority = await getTranscodingJobPriority({ user, type: 'studio' })

  if (CONFIG.VIDEO_STUDIO.REMOTE_RUNNERS.ENABLED) {
    // The duplicate job creates the edition again if the server stopped before the end of the duplication
    if (
      payload.isDuplicate === true &&
      await RunnerJobModel.hasNonFinishedJobOfVideo({ type: 'video-studio-transcoding', videoUUID: video.uuid })
    ) {
      logger.info('Remote studio job of video %s already exists.', video.uuid)
      return
    }

    await new VideoStudioTranscodingJobHandler().create({
      video,
      tasks: payload.tasks,
      taskFilesStaged: payload.taskFilesStaged,
      isDuplicate: payload.isDuplicate === true,
      priority
    })
    return
  }

  await JobQueue.Instance.createJob({
    type: 'video-studio-edition',
    payload,
    priority,
    // Only for the duplicate job, that creates the edition again if the server stopped before the end of the duplication
    deduplicationId: payload.isDuplicate === true
      ? `video-studio-edition-${video.uuid}`
      : undefined
  })
}

// The edition did not happen: give the video back its previous state, and notify its owner
export async function onVideoStudioFailed (options: {
  videoUUID: string
  isDuplicate: boolean
}) {
  const { videoUUID, isDuplicate } = options

  const video = await runTransaction(async transaction => {
    const video = await VideoModel.loadFull(videoUUID, transaction)
    if (!video || video.state !== VideoState.TO_EDIT) return undefined

    await video.setNewStateAndPublishedAt({ newState: buildStudioFailedState(video, isDuplicate), transaction })

    return video
  })

  if (video) Notifier.Instance.notifyOfFailedVideoStudioEdition(video)
}

export async function onVideoStudioEnded (options: {
  editionResultPath: string
  taskFiles: StudioTaskFiles
  video: MVideoFull

  // Can throw to cancel the end of the edition
  beforeIrreversibleChanges?: () => void
}) {
  const { taskFiles, editionResultPath, beforeIrreversibleChanges } = options

  const newFile = await buildNewFile({ input: { path: editionResultPath }, mode: 'web-video' })

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(options.video.uuid)

  let video: MVideoFull

  // Keep the lock until the new file is saved in database, so other jobs don't see (or update) the old files of the video
  try {
    video = await VideoModel.loadFull(options.video.uuid)

    // The video may have been deleted during its edition
    if (!video) {
      logger.info('Do not end the edition of video %s that does not exist anymore.', options.video.uuid)

      await remove(editionResultPath)
      await safeCleanupStudioTMPFiles(taskFiles)
      return
    }

    newFile.videoId = video.id

    const { localPath, cleanup, rollback } = await storeNewWebVideoFile({ video, videoFile: newFile, input: { path: editionResultPath } })

    let duration: number

    try {
      duration = await getVideoStreamDuration(localPath)

      beforeIrreversibleChanges?.()

      await safeCleanupStudioTMPFiles(taskFiles)

      const { infoHash, torrentFilename, torrentStorage } = await createTorrentForFileFromPath(video, newFile, localPath)
      await removeAllFilesUnderLock(video)

      await runTransaction(async t => {
        newFile.torrentFilename = torrentFilename
        newFile.torrentStorage = torrentStorage
        await newFile.save({ transaction: t })

        await VideoInfohashModel.replaceFileInfohash(newFile.id, infoHash, t)
      })
    } catch (err) {
      // The file was not saved in database: also remove it from its storage, so it is not left orphaned
      await rollback()
      throw err
    }

    await cleanup()

    video.duration = duration
    video.aspectRatio = buildAspectRatio({ width: newFile.width, height: newFile.height })
    await video.save()
  } finally {
    videoFileMutexReleaser()
  }

  await JobQueue.Instance.createSequentialJobFlow(
    await buildLocalStoryboardJobIfNeeded({ video, federate: false }),
    buildNonDuplicatedFederateVideoJob({ video }),
    {
      type: 'transcoding-job-builder' as 'transcoding-job-builder',
      payload: {
        videoUUID: video.uuid,
        optimizeJob: {}
      }
    }
  )

  await addRemoteStoryboardJobIfNeeded(video)
  await regenerateTranscriptionTaskIfNeeded(video)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildStudioFailedState (video: MVideoWithAllFiles, isDuplicate: boolean) {
  // The duplicate was created to receive the edition result: don't publish a copy of the source video instead
  if (isDuplicate) return VideoState.TO_EDIT_FAILED

  // The edition failed after the removal of the previous files of the video
  if (video.getAllFiles().length === 0) return VideoState.TRANSCODING_FAILED

  return VideoState.PUBLISHED
}

async function removeAllFilesUnderLock (video: MVideoWithAllFiles) {
  await removeHLSPlaylistUnderLock(video)

  // The new file is not saved in database yet, so it is not removed
  await removeAllWebVideoFilesUnderLock(video)
}
