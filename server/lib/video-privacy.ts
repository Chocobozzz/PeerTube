import { move } from 'fs-extra'
import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { DIRECTORIES } from '@server/initializers/constants'
import { MVideo, MVideoFullLight } from '@server/types/models'
import { VideoPrivacy } from '@shared/models'

function setVideoPrivacy (video: MVideo, newPrivacy: VideoPrivacy) {
  if (video.privacy === VideoPrivacy.PRIVATE && newPrivacy !== VideoPrivacy.PRIVATE) {
    video.publishedAt = new Date()
  }

  video.privacy = newPrivacy
}

function isVideoInPrivateDirectory (privacy: VideoPrivacy) {
  return privacy === VideoPrivacy.PRIVATE || privacy === VideoPrivacy.INTERNAL
}

function isVideoInPublicDirectory (privacy: VideoPrivacy) {
  return !isVideoInPrivateDirectory(privacy)
}

async function moveFilesIfPrivacyChanged (video: MVideoFullLight, oldPrivacy: VideoPrivacy) {
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

export {
  setVideoPrivacy,

  isVideoInPrivateDirectory,
  isVideoInPublicDirectory,

  moveFilesIfPrivacyChanged
}

// ---------------------------------------------------------------------------

async function moveFiles (options: {
  type: 'private-to-public' | 'public-to-private'
  video: MVideoFullLight
}) {
  const { type, video } = options

  const directories = type === 'private-to-public'
    ? {
      webtorrent: { old: DIRECTORIES.VIDEOS.PRIVATE, new: DIRECTORIES.VIDEOS.PUBLIC },
      hls: { old: DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, new: DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC }
    }
    : {
      webtorrent: { old: DIRECTORIES.VIDEOS.PUBLIC, new: DIRECTORIES.VIDEOS.PRIVATE },
      hls: { old: DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, new: DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE }
    }

  for (const file of video.VideoFiles) {
    const source = join(directories.webtorrent.old, file.filename)
    const destination = join(directories.webtorrent.new, file.filename)

    try {
      logger.info('Moving WebTorrent files of %s after privacy change (%s -> %s).', video.uuid, source, destination)

      await move(source, destination)
    } catch (err) {
      logger.error('Cannot move webtorrent file %s to %s after privacy change', source, destination, { err })
    }
  }

  const hls = video.getHLSPlaylist()

  if (hls) {
    const source = join(directories.hls.old, video.uuid)
    const destination = join(directories.hls.new, video.uuid)

    try {
      logger.info('Moving HLS files of %s after privacy change (%s -> %s).', video.uuid, source, destination)

      await move(source, destination)
    } catch (err) {
      logger.error('Cannot move HLS file %s to %s after privacy change', source, destination, { err })
    }
  }
}
