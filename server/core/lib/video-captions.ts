import { FileStorage } from '@peertube/peertube-models'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils.js'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions.js'
import { retryTransactionWrapper, runTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { MStreamingPlaylist, MVideo, MVideoCaption } from '@server/types/models/index.js'
import { ensureDir, remove } from 'fs-extra/esm'
import { writeFile } from 'fs/promises'
import { dirname } from 'path'
import { buildCaptionM3U8Content, updateM3U8AndShaPlaylistUnderLock } from './hls.js'
import { storeHLSFileFromContent, storeVideoCaption } from './object-storage/videos.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger('caption')

export async function createLocalCaption (options: {
  video: MVideo
  path: string
  language: string
  automaticallyGenerated: boolean
}) {
  const { language, path, video, automaticallyGenerated } = options

  const videoCaption = new VideoCaptionModel({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(language),
    storage: FileStorage.FILE_SYSTEM,
    language,
    automaticallyGenerated,
    cached: false
  }) as MVideoCaption

  await moveAndProcessCaptionFile({ path }, videoCaption)

  const captionDest = videoCaption.getFSFilePath()

  if (!await isVTTFileValid(captionDest)) {
    remove(captionDest)
      .catch(err => logger.error('Cannot remove invalid VTT file', { err }))

    throw new Error(`Invalid VTT file`)
  }

  // Store it in object storage right away, so it never stays on the file system of this process, that other processes cannot reach
  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    await storeVideoCaption(captionDest, videoCaption.filename)
    await remove(captionDest)

    videoCaption.storage = FileStorage.OBJECT_STORAGE
  }

  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)

  videoCaption.m3u8Filename = hls
    ? await upsertCaptionPlaylist(videoCaption, video)
    : null

  await retryTransactionWrapper(() => {
    return runTransaction(t => {
      return VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
    })
  })

  logger.info(`Created/replaced caption ${videoCaption.filename} of ${language} of video ${video.uuid}`)

  return Object.assign(videoCaption, { Video: video })
}

// ---------------------------------------------------------------------------

export async function createAllCaptionPlaylistsIfNeeded (video: MVideo) {
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)

  for (const caption of captions) {
    if (caption.m3u8Filename) continue

    try {
      caption.m3u8Filename = await upsertCaptionPlaylist(caption, video)
      await caption.save()
    } catch (err) {
      logger.error(`Cannot create caption playlist ${caption.filename} (${caption.language}) of video ${video.uuid}`, { err })
    }
  }
}

export async function updateHLSMasterOnCaptionChangeIfNeeded (video: MVideo) {
  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)
  if (!hls) return

  return updateHLSMasterOnCaptionChange(video, hls)
}

export async function updateHLSMasterOnCaptionChange (video: MVideo, hls: MStreamingPlaylist) {
  logger.debug(`Updating HLS master playlist of video ${video.uuid} after caption change`)

  await updateM3U8AndShaPlaylistUnderLock(video, hls)
}

// ---------------------------------------------------------------------------

export async function upsertCaptionPlaylist (caption: MVideoCaption, video: MVideo) {
  if (caption.storage === FileStorage.FILE_SYSTEM) return upsertCaptionPlaylistOnFS(caption, video)

  const m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)

  logger.debug(`Uploading caption playlist ${m3u8Filename} of video ${video.uuid} in object storage`)

  await storeHLSFileFromContent({ video, pathOrFilename: m3u8Filename, content: buildCaptionM3U8Content({ video, caption }) })

  return m3u8Filename
}

export async function upsertCaptionPlaylistOnFS (caption: MVideoCaption, video: MVideo) {
  const m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)
  const m3u8Destination = VideoPathManager.Instance.getFSHLSOutputPath(video, m3u8Filename)

  logger.debug(`Creating caption playlist ${m3u8Destination} of video ${video.uuid}`)

  const content = buildCaptionM3U8Content({ video, caption })
  await ensureDir(dirname(m3u8Destination))
  await writeFile(m3u8Destination, content, 'utf8')

  return m3u8Filename
}
