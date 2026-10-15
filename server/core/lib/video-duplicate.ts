import { FileStorage, VideoDuplicatePayload, VideoState } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'
import { copy } from 'fs-extra/esm'
import { extname } from 'path'
import { makeCommonFileAvailable, storeCommonFile } from './object-storage/common-files.js'
import { regenerateLocalVideoThumbnailsFromVideoIfNeeded } from './thumbnail.js'
import { ffprobePromise } from '@peertube/peertube-ffmpeg'
import { buildNewFile, storeNewWebVideoFile } from './video-file.js'
import { VideoPathManager } from './video-path-manager.js'
import { createVideoStudioJob, safeCleanupStudioTMPFiles } from './video-studio.js'
import { createTorrentForFileFromPath } from './webtorrent.js'
import { isUserQuotaValid } from './user.js'

const logger = createLogger('studio')

export async function duplicateVideoForStudio (payload: VideoDuplicatePayload) {
  const { videoUUID, sourceVideoUUID } = payload
  const releases: (() => void)[] = []

  try {
    for (const uuid of [ videoUUID, sourceVideoUUID ].sort()) {
      releases.push(await VideoPathManager.Instance.lockFiles(uuid))
    }

    let video = await VideoModel.loadFull(videoUUID)
    if (!video) {
      await safeCleanupStudioTMPFiles(payload.studio)
      return
    }

    if (video.state !== VideoState.TO_DUPLICATE) return

    const source = await VideoModel.loadFull(sourceVideoUUID)
    if (!source || source.getMaxQualityBytes() === 0) throw new Error('Source video is no longer available')
    const owner = await UserModel.loadByVideoId(video.id)
    if (!await isUserQuotaValid({ channelUserId: owner.id, uploadSize: source.getMaxQualityBytes() })) {
      throw new Error('Quota exceeded for this user to duplicate the video')
    }

    await copyStudioInput(source, video)

    video.state = VideoState.TO_EDIT_AS_NEW_VIDEO
    await video.save()

    video = await VideoModel.loadFull(videoUUID)
    const user = await UserModel.loadById(payload.userId)
    if (!user) throw new Error('Studio user is no longer available')

    await createVideoStudioJob({
      video,
      user,
      payload: { ...payload.studio, videoUUID, isNewVideo: true }
    })
  } catch (err) {
    await VideoModel.update({ state: VideoState.TO_DUPLICATE_FAILED }, {
      where: { uuid: videoUUID, state: VideoState.TO_DUPLICATE }
    })
    await VideoModel.update({ state: VideoState.TO_EDIT_FAILED }, {
      where: { uuid: videoUUID, state: VideoState.TO_EDIT_AS_NEW_VIDEO }
    })
    await safeCleanupStudioTMPFiles(payload.studio)
    throw err
  } finally {
    for (const release of releases.reverse()) release()
  }
}

async function copyStudioInput (source: MVideoFull, video: MVideoFull) {
  await VideoPathManager.Instance.makeAvailableMaxQualityFiles(source, async ({ videoPath, separatedAudioPath }) => {
    const stored: Awaited<ReturnType<typeof storeNewWebVideoFile>>[] = []
    const files: Awaited<ReturnType<typeof buildNewFile>>[] = []
    const infoHashes: string[] = []

    try {
      for (const path of [ videoPath, separatedAudioPath ].filter(Boolean)) {
        const file = await buildNewFile({ input: { path }, mode: 'web-video' })
        file.videoId = video.id

        const result = await storeNewWebVideoFile({ video, videoFile: file, input: { path }, keepInput: true })
        stored.push(result)

        const torrent = await createTorrentForFileFromPath(video, file, result.localPath)
        file.torrentFilename = torrent.torrentFilename
        file.torrentStorage = torrent.torrentStorage
        files.push(file)
        infoHashes.push(torrent.infoHash)
      }

      await runTransaction(async transaction => {
        for (const [ index, file ] of files.entries()) {
          await file.save({ transaction })
          await VideoInfohashModel.replaceFileInfohash(file.id, infoHashes[index], transaction)
        }
      })

      const current = await VideoModel.loadFull(video.uuid)
      await copyThumbnails(source, current)
      if (current.Thumbnails.length === 0) {
        await regenerateLocalVideoThumbnailsFromVideoIfNeeded(current, await ffprobePromise(videoPath), videoPath)
      }
    } catch (err) {
      for (const file of files) {
        await file.destroy().catch(cleanupErr => logger.error('Cannot remove copied file row.', { err: cleanupErr }))
        await file.removeTorrent().catch(cleanupErr => logger.error('Cannot remove copied torrent.', { err: cleanupErr }))
      }
      for (const result of stored) {
        await result.rollback().catch(cleanupErr => logger.error('Cannot remove copied media.', { err: cleanupErr }))
      }
      throw err
    } finally {
      for (const result of stored) await result.cleanup()
    }
  })
}

async function copyThumbnails (source: MVideoFull, video: MVideoFull) {
  if (video.Thumbnails.length !== 0) return

  const thumbnails: ThumbnailModel[] = []
  for (const sourceThumbnail of source.Thumbnails) {
    const thumbnail = new ThumbnailModel({
      filename: buildUUID() + extname(sourceThumbnail.filename),
      width: sourceThumbnail.width,
      height: sourceThumbnail.height,
      aspectRatio: sourceThumbnail.aspectRatio,
      automaticallyGenerated: sourceThumbnail.automaticallyGenerated,
      cached: false,
      storage: sourceThumbnail.storage
    })
    const store = async (path: string) => {
      if (thumbnail.storage === FileStorage.OBJECT_STORAGE) {
        await storeCommonFile('thumbnails', path, thumbnail.filename)
      } else {
        await copy(path, thumbnail.getFSPath())
      }
    }
    if (sourceThumbnail.storage === FileStorage.OBJECT_STORAGE) {
      await makeCommonFileAvailable('thumbnails', sourceThumbnail.filename, store)
    } else {
      await store(sourceThumbnail.getFSPath())
    }
    thumbnails.push(thumbnail)
  }
  if (thumbnails.length !== 0) await video.replaceAndSaveThumbnails(thumbnails)
}