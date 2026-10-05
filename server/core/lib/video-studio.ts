import { buildAspectRatio } from '@peertube/peertube-core-utils'
import { ffprobePromise, getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import {
  VideoChannelActivityAction,
  VideoPrivacy,
  VideoState,
  VideoStudioEditionPayload,
  VideoStudioTask,
  VideoStudioTaskPayload,
  hasVideoStudioTaskFile
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url.js'
import { buildNonDuplicatedFederateVideoJob } from '@server/lib/activitypub/videos/federate.js'
import { createTorrentForFileFromPath } from '@server/lib/webtorrent.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUser, MUserAccountId, MVideoFull, MVideoWithAllFiles, MVideoWithFile } from '@server/types/models/index.js'
import { move, remove } from 'fs-extra/esm'
import { basename, join } from 'path'
import { buildNonDuplicatedVideoAutomaticTagsJob } from './automatic-tags/automatic-tags.js'
import { JobQueue } from './job-queue/index.js'
import { buildStagingKey, downloadStagingObject, removeStagingObject, storeStagingObject } from './object-storage/staging.js'
import { VideoStudioTranscodingJobHandler } from './runners/index.js'
import { getTranscodingJobPriority } from './transcoding/transcoding-priority.js'
import { regenerateLocalVideoThumbnailsFromVideoIfNeeded } from './thumbnail.js'
import { autoBlacklistVideoIfNeeded } from './video-blacklist.js'
import { regenerateTranscriptionTaskIfNeeded } from './video-captions.js'
import { buildNewFile, removeAllWebVideoFilesUnderLock, removeHLSPlaylistUnderLock, storeNewWebVideoFile } from './video-file.js'
import { addRemoteStoryboardJobIfNeeded, buildLocalStoryboardJobIfNeeded } from './video-jobs.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger('studio')

export function buildTaskFileFieldname (indice: number, fieldName = 'file') {
  return `tasks[${indice}][options][${fieldName}]`
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
  // Video that receives the result
  video: MVideoWithFile
  // Video to read the input from, set when the result is saved in a new video
  sourceVideo?: MVideoWithFile
  user: MUser
  payload: VideoStudioEditionPayload
}) {
  const { video, sourceVideo, user, payload } = options

  const priority = await getTranscodingJobPriority({ user, type: 'studio' })

  if (CONFIG.VIDEO_STUDIO.REMOTE_RUNNERS.ENABLED) {
    await new VideoStudioTranscodingJobHandler().create({
      video,
      sourceVideo,
      tasks: payload.tasks,
      taskFilesStaged: payload.taskFilesStaged,
      priority
    })
    return
  }

  await JobQueue.Instance.createJob({ type: 'video-studio-edition', payload, priority })
}

export async function createNewVideoForStudio (options: {
  sourceVideo: MVideoFull
  name: string
  user: MUserAccountId
}) {
  const { sourceVideo, name, user } = options
  const channel = sourceVideo.VideoChannel

  // Descriptive metadata is only a default: the user reviews it in the video form before the edition ends
  const video = new VideoModel({
    uuid: buildUUID(),
    name,
    state: VideoState.TO_EDIT_AS_NEW_VIDEO,
    remote: false,
    isLive: false,
    channelId: channel.id,

    // Don't publish a copy before the user reviewed it
    privacy: VideoPrivacy.PRIVATE,

    category: sourceVideo.category,
    licence: sourceVideo.licence,
    language: sourceVideo.language,
    description: sourceVideo.description,
    support: sourceVideo.support,
    nsfw: sourceVideo.nsfw,
    nsfwSummary: sourceVideo.nsfwSummary,
    nsfwFlags: sourceVideo.nsfwFlags,
    commentsPolicy: sourceVideo.commentsPolicy,
    downloadEnabled: sourceVideo.downloadEnabled,
    waitTranscoding: sourceVideo.waitTranscoding,
    embedPrivacyPolicy: sourceVideo.embedPrivacyPolicy,

    publishedAt: new Date(),
    duration: sourceVideo.duration
  }) as MVideoFull

  video.VideoChannel = channel
  video.url = getLocalVideoActivityPubUrl(video)

  await sequelizeTypescript.transaction(async transaction => {
    await video.save({ transaction })

    await VideoChannelActivityModel.addVideoActivity({
      action: VideoChannelActivityAction.CREATE,
      user,
      channel,
      video,
      transaction
    })
  })

  return video
}

// Remove the video created for a failed/cancelled edition, or give the edited video back its previous state
export function onVideoStudioFailed (options: {
  videoUUID: string
  isNewVideo: boolean
}) {
  const { videoUUID, isNewVideo } = options

  return sequelizeTypescript.transaction(async transaction => {
    const video = await VideoModel.load(videoUUID, transaction)
    if (!video || video.state === VideoState.PUBLISHED) return

    // The new video has no content to fall back on. Later states are handled by the jobs that follow the edition
    if (isNewVideo) {
      if (video.state === VideoState.TO_EDIT_AS_NEW_VIDEO) await video.destroy({ transaction })
      return
    }

    await video.setNewStateAndPublishedAt({ newState: VideoState.PUBLISHED, transaction })
  })
}

export async function onVideoStudioEnded (options: {
  editionResultPath: string
  taskFiles: StudioTaskFiles
  video: MVideoFull
  isNewVideo?: boolean

  // Can throw to cancel the end of the edition
  beforeIrreversibleChanges?: () => void
}) {
  const { taskFiles, editionResultPath, isNewVideo = false, beforeIrreversibleChanges } = options

  const newFile = await buildNewFile({ input: { path: editionResultPath }, mode: 'web-video' })

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(options.video.uuid)

  let video: MVideoFull

  // Keep the lock until the new file is saved in database, so other jobs don't see (or update) the old files of the video
  try {
    video = await VideoModel.loadFull(options.video.uuid)
    newFile.videoId = video.id

    const { localPath, cleanup, rollback } = await storeNewWebVideoFile({ video, videoFile: newFile, input: { path: editionResultPath } })

    let duration: number

    try {
      if (!localPath) throw new Error('Cannot access the local video studio result file')

      beforeIrreversibleChanges?.()

      await safeCleanupStudioTMPFiles(taskFiles)

      const { infoHash, torrentFilename, torrentStorage } = await createTorrentForFileFromPath(video, newFile, localPath)
      await removeAllFilesUnderLock(video)

      await sequelizeTypescript.transaction(async t => {
        newFile.torrentFilename = torrentFilename
        newFile.torrentStorage = torrentStorage
        await newFile.save({ transaction: t })

        await VideoInfohashModel.replaceFileInfohash(newFile.id, infoHash, t)
      })

      duration = await getVideoStreamDuration(localPath)
      video.duration = duration
      video.aspectRatio = buildAspectRatio({ width: newFile.width, height: newFile.height })
      await video.save()

      if (isNewVideo) await prepareNewVideoAfterStudio(video, localPath)

      await cleanup()
    } catch (err) {
      // The file was not saved in database: also remove it from its storage, so it is not left orphaned
      await rollback()
      throw err
    }
  } finally {
    videoFileMutexReleaser()
  }

  await JobQueue.Instance.createSequentialJobFlow(
    await buildLocalStoryboardJobIfNeeded({ video, federate: false }),
    // Like an upload: apply auto tags policies before the video is announced
    isNewVideo
      ? buildNonDuplicatedVideoAutomaticTagsJob({ video, moderation: 'apply' })
      : undefined,
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

// The new video was created without file, thumbnail nor moderation check
async function prepareNewVideoAfterStudio (video: MVideoFull, videoPath: string) {
  const videoWithFiles = await VideoModel.loadFull(video.uuid)

  await regenerateLocalVideoThumbnailsFromVideoIfNeeded(videoWithFiles, await ffprobePromise(videoPath), videoPath)

  await autoBlacklistVideoIfNeeded({
    video: videoWithFiles,
    user: await UserModel.loadByVideoId(video.id),
    isRemote: false,
    isNew: true,
    isNewFile: true,
    holdIfAutoTagPolicy: false
  })

  await videoWithFiles.VideoChannel.setAsUpdated()
}

async function removeAllFilesUnderLock (video: MVideoWithAllFiles) {
  await removeHLSPlaylistUnderLock(video)

  // The new file is not saved in database yet, so it is not removed
  await removeAllWebVideoFilesUnderLock(video)
}
