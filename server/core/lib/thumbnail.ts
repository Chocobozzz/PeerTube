import { ThumbnailType, ThumbnailType_Type, VideoFileStream } from '@peertube/peertube-models'
import { generateThumbnailFromVideo } from '@server/helpers/ffmpeg/ffmpeg-image.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import Bluebird from 'bluebird'
import { FfprobeData } from 'fluent-ffmpeg'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { generateImageFilename } from '../helpers/image-utils.js'
import { CONFIG } from '../initializers/config.js'
import { ASSETS_PATH, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '../initializers/constants.js'
import { ThumbnailModel } from '../models/video/thumbnail.js'
import { MVideoFile, MVideoThumbnail, MVideoUUID, MVideoWithAllFiles } from '../types/models/index.js'
import { MThumbnail } from '../types/models/video/thumbnail.js'
import { MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import { VideoPathManager } from './video-path-manager.js'
import { downloadImageFromWorker, processImageFromWorker } from './worker/parent-process.js'

const lTags = loggerTagsFactory('thumbnail')

type ImageSize = { height?: number, width?: number }

export function updateLocalPlaylistMiniatureFromExisting (options: {
  inputPath: string
  playlist: MVideoPlaylistThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
  size?: ImageSize
}) {
  const { inputPath, playlist, automaticallyGenerated, keepOriginal = false, size } = options
  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  const thumbnailCreator = () => {
    return processImageFromWorker({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    onDisk: true,
    existingThumbnail
  })
}

export function updateRemotePlaylistMiniatureFromUrl (options: {
  downloadUrl: string
  playlist: MVideoPlaylistThumbnail
  size?: ImageSize
}) {
  const { downloadUrl, playlist, size } = options
  const { filename, basePath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  // Only save the file URL if it is a remote playlist
  const fileUrl = playlist.isOwned()
    ? null
    : downloadUrl

  const thumbnailCreator = () => {
    return downloadImageFromWorker({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
  }

  return updateThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl, onDisk: true })
}

// ---------------------------------------------------------------------------

export function updateLocalVideoMiniatureFromExisting (options: {
  inputPath: string
  video: MVideoThumbnail
  type: ThumbnailType_Type
  automaticallyGenerated: boolean
  size?: ImageSize
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, video, type, automaticallyGenerated, size, keepOriginal = false } = options

  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnailCreator = () => {
    return processImageFromWorker({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    existingThumbnail,
    onDisk: true
  })
}

// Returns thumbnail models sorted by their size (height) in descendent order (biggest first)
export function generateLocalVideoMiniature (options: {
  video: MVideoThumbnail
  videoFile: MVideoFile
  types: ThumbnailType_Type[]
  ffprobe: FfprobeData
}): Promise<MThumbnail[]> {
  const { video, videoFile, types, ffprobe } = options

  if (types.length === 0) return Promise.resolve([])

  return VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), input => {
    // Get bigger images to generate first
    const metadatas = types.map(type => buildMetadataFromVideo(video, type))
      .sort((a, b) => {
        if (a.height < b.height) return 1
        if (a.height === b.height) return 0
        return -1
      })

    let biggestImagePath: string
    return Bluebird.mapSeries(metadatas, metadata => {
      const { filename, basePath, height, width, existingThumbnail, outputPath, type } = metadata

      let thumbnailCreator: () => Promise<any>

      if (videoFile.isAudio()) {
        thumbnailCreator = () => processImageFromWorker({
          path: ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND,
          destination: outputPath,
          newSize: { width, height },
          keepOriginal: true
        })
      } else if (biggestImagePath) {
        thumbnailCreator = () => processImageFromWorker({
          path: biggestImagePath,
          destination: outputPath,
          newSize: { width, height },
          keepOriginal: true
        })
      } else {
        thumbnailCreator = () => generateImageFromVideoFile({
          fromPath: input,
          folder: basePath,
          imageName: filename,
          size: { height, width },
          ffprobe
        })
      }

      if (!biggestImagePath) biggestImagePath = outputPath

      return updateThumbnailFromFunction({
        thumbnailCreator,
        filename,
        height,
        width,
        type,
        automaticallyGenerated: true,
        onDisk: true,
        existingThumbnail
      })
    })
  })
}

// ---------------------------------------------------------------------------

export function updateLocalVideoMiniatureFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnail
  type: ThumbnailType_Type
  size?: ImageSize
}) {
  const { downloadUrl, video, type, size } = options
  const { filename: updatedFilename, basePath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  // Only save the file URL if it is a remote video
  const fileUrl = video.isOwned()
    ? null
    : downloadUrl

  const thumbnailUrlChanged = hasThumbnailUrlChanged(existingThumbnail, downloadUrl, video)

  // Do not change the thumbnail filename if the file did not change
  const filename = thumbnailUrlChanged
    ? updatedFilename
    : existingThumbnail.filename

  const thumbnailCreator = () => {
    if (thumbnailUrlChanged) {
      return downloadImageFromWorker({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
    }

    return Promise.resolve()
  }

  return updateThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl, onDisk: true })
}

export function updateRemoteVideoThumbnail (options: {
  fileUrl: string
  video: MVideoThumbnail
  type: ThumbnailType_Type
  size: ImageSize
  onDisk: boolean
}) {
  const { fileUrl, video, type, size, onDisk } = options
  const { filename: generatedFilename, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnail = existingThumbnail || new ThumbnailModel()

  // Do not change the thumbnail filename if the file did not change
  if (hasThumbnailUrlChanged(existingThumbnail, fileUrl, video)) {
    thumbnail.previousThumbnailFilename = thumbnail.filename
    thumbnail.filename = generatedFilename
  }

  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.onDisk = onDisk

  return thumbnail
}

// ---------------------------------------------------------------------------

export async function regenerateMiniaturesIfNeeded (video: MVideoWithAllFiles, ffprobe: FfprobeData) {
  const thumbnailsToGenerate: ThumbnailType_Type[] = []

  if (video.getMiniature().automaticallyGenerated === true) {
    thumbnailsToGenerate.push(ThumbnailType.MINIATURE)
  }

  if (video.getPreview().automaticallyGenerated === true) {
    thumbnailsToGenerate.push(ThumbnailType.PREVIEW)
  }

  const models = await generateLocalVideoMiniature({
    video,
    videoFile: video.getMaxQualityFile(VideoFileStream.VIDEO) || video.getMaxQualityFile(VideoFileStream.AUDIO),
    ffprobe,
    types: thumbnailsToGenerate
  })

  for (const model of models) {
    await video.addAndSaveThumbnail(model)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function hasThumbnailUrlChanged (existingThumbnail: MThumbnail, downloadUrl: string, video: MVideoUUID) {
  const existingUrl = existingThumbnail
    ? existingThumbnail.fileUrl
    : null

  // If the thumbnail URL did not change and has a unique filename (introduced in 3.1), avoid thumbnail processing
  return !existingUrl || existingUrl !== downloadUrl || downloadUrl.endsWith(`${video.uuid}.jpg`)
}

function buildMetadataFromPlaylist (playlist: MVideoPlaylistThumbnail, size: ImageSize) {
  const filename = playlist.generateThumbnailName()
  const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

  return {
    filename,
    basePath,
    existingThumbnail: playlist.Thumbnail,
    outputPath: join(basePath, filename),
    height: size ? size.height : THUMBNAILS_SIZE.height,
    width: size ? size.width : THUMBNAILS_SIZE.width
  }
}

function buildMetadataFromVideo (video: MVideoThumbnail, type: ThumbnailType_Type, size?: ImageSize) {
  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.type === type)
    : undefined

  if (type === ThumbnailType.MINIATURE) {
    const filename = generateImageFilename()
    const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

    return {
      type,
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : THUMBNAILS_SIZE.height,
      width: size ? size.width : THUMBNAILS_SIZE.width
    }
  }

  if (type === ThumbnailType.PREVIEW) {
    const filename = generateImageFilename()
    const basePath = CONFIG.STORAGE.PREVIEWS_DIR

    return {
      type,
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : PREVIEWS_SIZE.height,
      width: size ? size.width : PREVIEWS_SIZE.width
    }
  }

  return undefined
}

async function updateThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>
  filename: string
  height: number
  width: number
  type: ThumbnailType_Type
  onDisk: boolean
  automaticallyGenerated?: boolean
  fileUrl?: string
  existingThumbnail?: MThumbnail
}) {
  const {
    thumbnailCreator,
    filename,
    width,
    height,
    type,
    existingThumbnail,
    onDisk,
    automaticallyGenerated = null,
    fileUrl = null
  } = parameters

  const oldFilename = existingThumbnail && existingThumbnail.filename !== filename
    ? existingThumbnail.filename
    : undefined

  const thumbnail: MThumbnail = existingThumbnail || new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.automaticallyGenerated = automaticallyGenerated
  thumbnail.onDisk = onDisk

  if (oldFilename) thumbnail.previousThumbnailFilename = oldFilename

  await thumbnailCreator()

  return thumbnail
}

async function generateImageFromVideoFile (options: {
  fromPath: string
  folder: string
  imageName: string
  size: { width: number, height: number }
  ffprobe?: FfprobeData
}) {
  const { fromPath, folder, imageName, size, ffprobe } = options

  const pendingImageName = 'pending-' + imageName
  const pendingImagePath = join(folder, pendingImageName)

  try {
    const framesToAnalyze = CONFIG.THUMBNAILS.GENERATION_FROM_VIDEO.FRAMES_TO_ANALYZE
    await generateThumbnailFromVideo({ fromPath, output: pendingImagePath, framesToAnalyze, ffprobe, scale: size })

    const destination = join(folder, imageName)
    await processImageFromWorker({ path: pendingImagePath, destination, newSize: size })

    return destination
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err, ...lTags() })

    try {
      await remove(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err, ...lTags() })
    }

    throw err
  }
}
