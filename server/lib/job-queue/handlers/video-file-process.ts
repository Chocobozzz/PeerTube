import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { getDurationFromVideoFile, getMetadataFromFile, getVideoFileFPS, getVideoFileResolution } from '@server/helpers/ffprobe-utils'
import { logger } from '@server/helpers/logger'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { DEFAULT_AUDIO_RESOLUTION } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { Notifier } from '@server/lib/notifier'
import { Hooks } from '@server/lib/plugins/hooks'
import { generateVideoMiniature } from '@server/lib/thumbnail'
import { addOptimizeOrMergeAudioJob, buildVideoThumbnailsFromReq } from '@server/lib/video'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { generateVideoFilename, getVideoFilePath } from '@server/lib/video-paths'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MUserAccountUrl, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { getLowercaseExtension } from '@server/helpers/core-utils'
import { VideoState } from '@shared/models'
import * as Bull from 'bull'
import { move } from 'fs-extra'
import express = require('express')
import { UserModel } from '@server/models/user/user'
import { VideoProcessPayload } from '@shared/models/server/job.model'

async function processVideoProcess (job: Bull.Job) {
  const { videoPhysicalFile, previewFilePath, videoId, userId } = job.data as VideoProcessPayload
  const user: MUserAccountUrl = await UserModel.loadForMeAPI(userId)
  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)

  const videoFile = await moveVideoFile({
    video,
    videoPhysicalFile
  })

  video.duration = await getDurationFromVideoFile(videoPhysicalFile.path)

  await handleVideoFile({
    previewFilePath,
    videoFile,
    video,
    user
  })
}

export {
  processVideoProcess
}

async function moveVideoFile ({
  video,
  videoPhysicalFile
}) {
  const videoFile = await buildNewFile(video, videoPhysicalFile)

  const destination = getVideoFilePath(video, videoFile)
  await move(videoPhysicalFile.path, destination)

  return videoFile
}

async function buildNewFile (video: MVideo, videoPhysicalFile: express.VideoUploadFile) {
  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(videoPhysicalFile.filename),
    size: videoPhysicalFile.size,
    videoStreamingPlaylistId: null,
    metadata: await getMetadataFromFile(videoPhysicalFile.path)
  })

  if (videoFile.isAudio()) {
    videoFile.resolution = DEFAULT_AUDIO_RESOLUTION
  } else {
    videoFile.fps = await getVideoFileFPS(videoPhysicalFile.path)
    videoFile.resolution = (await getVideoFileResolution(videoPhysicalFile.path)).videoFileResolution
  }

  videoFile.filename = generateVideoFilename(video, false, videoFile.resolution, videoFile.extname)

  return videoFile
}

async function handleVideoFile ({
  previewFilePath,
  videoFile,
  video,
  user
}) {
  const files = previewFilePath
    ? {
      previewfile: [
        {
          path: previewFilePath
        }
      ]
    }
    : {}
  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video,
    files,
    fallback: type => generateVideoMiniature({ video, videoFile, type })
  })

  await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }
    await video.addAndSaveThumbnail(thumbnailModel, t)
    await video.addAndSaveThumbnail(previewModel, t)
    video.url = getLocalVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

    video.state = CONFIG.TRANSCODING.ENABLED
      ? VideoState.TO_TRANSCODE
      : VideoState.PUBLISHED

    videoFile.videoId = video.id
    await videoFile.save(sequelizeOptions)

    video.VideoFiles = [ videoFile ]

    // Channel has a new content, set as updated
    await video.VideoChannel.setAsUpdated(t)

    await autoBlacklistVideoIfNeeded({
      video,
      user,
      isRemote: false,
      isNew: true,
      transaction: t
    })
  })

  createTorrentFederate(video, videoFile)

  if (video.state === VideoState.TO_TRANSCODE) {
    await addOptimizeOrMergeAudioJob(video, videoFile, user)
  }

  Hooks.runAction('action:api.video.uploaded', { video: video })
}

function createTorrentFederate (video: MVideoFullLight, videoFile: MVideoFile): void {
  // Create the torrent file in async way because it could be long
  createTorrentAndSetInfoHashAsync(video, videoFile)
    .catch(err => logger.error('Cannot create torrent file for video %s', video.url, { err }))
    .then(() => VideoModel.loadAndPopulateAccountAndServerAndTags(video.id))
    .then(refreshedVideo => {
      if (!refreshedVideo) return

      // Only federate and notify after the torrent creation
      Notifier.Instance.notifyOnNewVideoIfNeeded(refreshedVideo)

      return retryTransactionWrapper(() => {
        return sequelizeTypescript.transaction(t => federateVideoIfNeeded(refreshedVideo, true, t))
      })
    })
    .catch(err => logger.error('Cannot federate or notify video creation %s', video.url, { err }))
}

async function createTorrentAndSetInfoHashAsync (video: MVideo, fileArg: MVideoFile) {
  await createTorrentAndSetInfoHash(video, fileArg)

  // Refresh videoFile because the createTorrentAndSetInfoHash could be long
  const refreshedFile = await VideoFileModel.loadWithVideo(fileArg.id)
  // File does not exist anymore, remove the generated torrent
  if (!refreshedFile) return fileArg.removeTorrent()

  refreshedFile.infoHash = fileArg.infoHash
  refreshedFile.torrentFilename = fileArg.torrentFilename

  return refreshedFile.save()
}
