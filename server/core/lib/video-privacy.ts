import { FileStorage, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { MVideo, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { move } from 'fs-extra/esm'
import { join } from 'path'
import { updateHLSFilesACL, updateWebVideoFileACL } from './object-storage/index.js'

const lTags = loggerTagsFactory('video-privacy')

const validPrivacySet = new Set<VideoPrivacyType>([
  VideoPrivacy.PRIVATE,
  VideoPrivacy.INTERNAL,
  VideoPrivacy.PASSWORD_PROTECTED
])

export function setVideoPrivacy (video: MVideo, newPrivacy: VideoPrivacyType) {
  if (video.privacy === VideoPrivacy.PRIVATE && newPrivacy !== VideoPrivacy.PRIVATE) {
    video.publishedAt = new Date()
  }

  video.privacy = newPrivacy
}

export function isVideoInPrivateDirectory (privacy: VideoPrivacyType) {
  return validPrivacySet.has(privacy)
}

export function isVideoInPublicDirectory (privacy: VideoPrivacyType) {
  return !isVideoInPrivateDirectory(privacy)
}

export async function moveFilesIfPrivacyChanged (video: MVideoFullLight, oldPrivacy: VideoPrivacyType) {
  // Now public, previously private
  if (isVideoInPublicDirectory(video.privacy) && isVideoInPrivateDirectory(oldPrivacy)) {
    await moveFiles({ type: 'private-to-public', video })

    return true
  }

  // Now private, previously public
  if (isVideoInPrivateDirectory(video.privacy) && isVideoInPublicDirectory(oldPrivacy)) {
    await moveFiles({ type: 'public-to-private', video })

    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type MoveType = 'private-to-public' | 'public-to-private'

async function moveFiles (options: {
  type: MoveType
  video: MVideoFullLight
}) {
  const { type, video } = options

  // Catch ACL error because it doesn't break the video
  // Do not catch FS error, that should not happen, because it can break the video
  const objectStorageErrorMsg = 'Cannot update ACL of video file after privacy change. ' +
    'Ensure your provider supports ACL or set object_storage.upload_acl.public and object_storage.upload_acl.public to null'

  for (const file of video.VideoFiles) {
    if (file.storage === FileStorage.FILE_SYSTEM) {
      await moveWebVideoFileOnFS(type, video, file)
    } else {
      try {
        await updateWebVideoFileACL(video, file)
      } catch (err) {
        logger.error(objectStorageErrorMsg, { err, ...lTags('object-storage', video.uuid) })
      }
    }
  }

  const hls = video.getHLSPlaylist()

  if (hls) {
    if (hls.storage === FileStorage.FILE_SYSTEM) {
      await moveHLSFilesOnFS(type, video)
    } else {
      try {
        await updateHLSFilesACL(hls)
      } catch (err) {
        logger.error(objectStorageErrorMsg, { err, ...lTags('object-storage', video.uuid) })
      }
    }
  }
}

async function moveWebVideoFileOnFS (type: MoveType, video: MVideo, file: MVideoFile) {
  const directories = getWebVideoDirectories(type)

  const source = join(directories.old, file.filename)
  const destination = join(directories.new, file.filename)

  try {
    logger.info('Moving web video files of %s after privacy change (%s -> %s).', video.uuid, source, destination)

    await move(source, destination)
  } catch (err) {
    logger.error('Cannot move web video file %s to %s after privacy change', source, destination, { err })
  }
}

function getWebVideoDirectories (moveType: MoveType) {
  if (moveType === 'private-to-public') {
    return { old: DIRECTORIES.WEB_VIDEOS.PRIVATE, new: DIRECTORIES.WEB_VIDEOS.PUBLIC }
  }

  return { old: DIRECTORIES.WEB_VIDEOS.PUBLIC, new: DIRECTORIES.WEB_VIDEOS.PRIVATE }
}

// ---------------------------------------------------------------------------

async function moveHLSFilesOnFS (type: MoveType, video: MVideo) {
  const directories = getHLSDirectories(type)

  const source = join(directories.old, video.uuid)
  const destination = join(directories.new, video.uuid)

  try {
    logger.info('Moving HLS files of %s after privacy change (%s -> %s).', video.uuid, source, destination)

    await move(source, destination)
  } catch (err) {
    logger.error('Cannot move HLS file %s to %s after privacy change', source, destination, { err })
  }
}

function getHLSDirectories (moveType: MoveType) {
  if (moveType === 'private-to-public') {
    return { old: DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, new: DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC }
  }

  return { old: DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, new: DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE }
}
