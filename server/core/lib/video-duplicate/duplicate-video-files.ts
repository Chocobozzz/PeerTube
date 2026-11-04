import { VideoDuplicatePayload, VideoState } from '@peertube/peertube-models'
import { runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { createVideoAutomaticTagsJob } from '@server/lib/automatic-tags/automatic-tags.js'
import { updateM3U8AndShaPlaylistUnderLockOrThrow } from '@server/lib/hls.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { createAllCaptionPlaylistsIfNeeded } from '@server/lib/video-captions.js'
import { addLocalOrRemoteStoryboardJobIfNeeded } from '@server/lib/video-jobs.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToNextState } from '@server/lib/video-state.js'
import { createVideoStudioJob, onVideoStudioFailed, safeCleanupStudioTMPFiles } from '@server/lib/video-studio.js'
import { createTorrentForFile, createTorrentFromTorrentOf } from '@server/lib/webtorrent.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFile, MVideoFull } from '@server/types/models/index.js'
import { copyAllFiles, copyMaxQualityFiles, getInputFilenames, Rollback } from './shared/copy-files.js'

const logger = createLogger('video-duplicate')

export async function duplicateVideoFiles (payload: VideoDuplicatePayload) {
  const { videoUUID, sourceVideoUUID } = payload

  const videoReleaser = await VideoPathManager.Instance.lockFiles(videoUUID)

  let video: MVideoFull

  try {
    video = await VideoModel.loadFull(videoUUID)
    if (!video) {
      logger.info('Do not duplicate video %s in video %s that does not exist anymore.', sourceVideoUUID, videoUUID)

      if (payload.studio) await safeCleanupStudioTMPFiles(payload.studio)
      return
    }

    // Already processed: the job is run again if the server stopped after the end of its processing
    if (video.state !== VideoState.TO_DUPLICATE) {
      logger.info('Do not duplicate video %s in video %s that is not waiting for its files.', sourceVideoUUID, videoUUID)

      // The server may have stopped before the creation of the edition
      if (payload.studio && video.state === VideoState.TO_EDIT) await createEdition({ video, payload })

      return
    }

    let sourceFiles: Map<string, MVideoFile>

    if (video.getAllFiles().length !== 0) {
      logger.info('Files of video %s are already copied in video %s.', sourceVideoUUID, videoUUID)
    } else {
      sourceFiles = await copySourceFiles({ payload, video })

      // Get the copies saved in the database
      video = await VideoModel.loadFull(videoUUID)
      if (!video) throw new Error(`Video ${videoUUID} does not exist anymore`)
    }

    if (payload.filesToCopy === 'all') {
      await completeCopiedFiles({ video, sourceFiles })
    }
  } catch (err) {
    await onVideoDuplicateFailed(payload)
    throw err
  } finally {
    videoReleaser()
  }

  try {
    await onVideoDuplicated({ payload, video })
  } catch (err) {
    // The duplicate has its files, but could not be moderated or handed to its next step
    await onVideoDuplicateFailed(payload)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

// Returns the filename of each copy -> its source file, if all the files are copied
async function copySourceFiles (options: {
  payload: VideoDuplicatePayload
  video: MVideoFull
}) {
  const { payload, video } = options
  const { sourceVideoUUID } = payload

  const rollbacks: Rollback[] = []

  const sourceReleaser = await VideoPathManager.Instance.lockFiles(sourceVideoUUID)

  try {
    const source = await VideoModel.loadFull(sourceVideoUUID)
    if (!source) throw new Error(`Cannot duplicate video ${sourceVideoUUID} that does not exist anymore`)

    // The studio tasks were validated against these files
    if (payload.studio && getInputFilenames(source).join() !== payload.studio.sourceFilenames.join()) {
      throw new Error(`Cannot duplicate video ${sourceVideoUUID} whose files changed since the studio edition was requested`)
    }

    const owner = await UserModel.loadByVideoId(video.id)
    if (await isUserQuotaValid({ channelUserId: owner.id, uploadSize: source.getMaxQualityBytes() }) === false) {
      throw new Error('Quota exceeded for this user to duplicate the video')
    }

    logger.info('Duplicating video %s in video %s.', source.uuid, video.uuid, { tags: [ video.uuid ] })

    if (payload.filesToCopy === 'max-quality') {
      await copyMaxQualityFiles({ source, video, rollbacks })
      return undefined
    }

    return await copyAllFiles({ source, video, rollbacks })
  } catch (err) {
    for (const rollback of rollbacks) {
      await rollback()
        .catch(rollbackErr => logger.error('Cannot remove a copied file of the failed duplicate %s.', video.uuid, { err: rollbackErr }))
    }

    throw err
  } finally {
    sourceReleaser()
  }
}

async function completeCopiedFiles (options: {
  video: MVideoFull

  // undefined if the files were copied by a previous run of the job
  sourceFiles: Map<string, MVideoFile> | undefined
}) {
  const { video, sourceFiles } = options

  const playlist = video.getHLSPlaylist()

  for (const file of video.getAllFiles()) {
    if (file.torrentFilename) continue

    const videoOrPlaylist = file.isHLS()
      ? playlist
      : video

    const sourceFile = sourceFiles?.get(file.filename)

    const { infoHash, torrentFilename, torrentStorage } = sourceFile
      ? await createTorrentFromTorrentOf({ videoOrPlaylist, videoFile: file, sourceFile })
      : await createTorrentForFile(videoOrPlaylist, file)

    file.torrentFilename = torrentFilename
    file.torrentStorage = torrentStorage

    await runTransaction(async transaction => {
      await file.save({ transaction })
      await VideoInfohashModel.replaceFileInfohash(file.id, infoHash, transaction)
    })
  }

  if (playlist) {
    await createAllCaptionPlaylistsIfNeeded(video)
    await updateM3U8AndShaPlaylistUnderLockOrThrow(video, playlist)
  }
}

// ---------------------------------------------------------------------------

async function onVideoDuplicateFailed (payload: VideoDuplicatePayload) {
  const [ updated ] = await VideoModel.update(
    { state: VideoState.TO_DUPLICATE_FAILED },
    { where: { uuid: payload.videoUUID, state: VideoState.TO_DUPLICATE } }
  )

  // The studio edition will not be created
  if (payload.studio) await safeCleanupStudioTMPFiles(payload.studio)

  if (updated !== 0) {
    const video = await VideoModel.loadFull(payload.videoUUID)
    if (video) Notifier.Instance.notifyOfFailedVideoDuplication(video)
  }
}

async function onVideoDuplicated (options: {
  payload: VideoDuplicatePayload
  video: MVideoFull
}) {
  const { payload, video } = options

  logger.info('Video %s duplicated in video %s.', payload.sourceVideoUUID, video.uuid, { tags: [ video.uuid ] })

  const autoBlacklistStatus = await autoBlacklistVideoIfNeeded({
    video,
    user: await UserModel.loadByVideoId(video.id),
    holdIfAutoTagPolicy: true,
    isRemote: false,
    isNew: true,
    isNewFile: true
  })

  createVideoAutomaticTagsJob({
    video,
    moderation: autoBlacklistStatus === 'held-for-auto-tags'
      ? 'release-hold'
      : 'apply'
  })

  // The studio edition generates the storyboard
  if (payload.studio) {
    video.state = VideoState.TO_EDIT
    await video.save()

    await createEdition({ video, payload })
    return
  }

  await addLocalOrRemoteStoryboardJobIfNeeded({ video, federate: true })
  await moveToNextState({ video, previousVideoState: VideoState.TO_DUPLICATE })
}

async function createEdition (options: {
  video: MVideoFull
  payload: VideoDuplicatePayload
}) {
  const { video, payload } = options

  try {
    await createVideoStudioJob({
      video,
      user: await UserModel.loadByVideoId(video.id),
      payload: { videoUUID: video.uuid, tasks: payload.studio.tasks, taskFilesStaged: payload.studio.taskFilesStaged, isDuplicate: true }
    })
  } catch (err) {
    await onVideoStudioFailed({ videoUUID: video.uuid, isDuplicate: true })
    throw err
  }
}
