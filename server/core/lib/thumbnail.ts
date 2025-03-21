import { FileStorage, ThumbnailType, ThumbnailType_Type, VideoFileStream } from '@peertube/peertube-models'
import { generateThumbnailFromVideo } from '@server/helpers/ffmpeg/ffmpeg-image.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import Bluebird from 'bluebird'
import { FfprobeData } from 'fluent-ffmpeg'
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
import { copyThumbnailFile, storeThumbnailFile } from './object-storage/thumbnail.js'

const lTags = loggerTagsFactory('thumbnail')

type ImageSize = { height?: number, width?: number }

export async function copyLocalPlaylistMiniatureFromObjectStorage (options: {
  sourceThumbnail: MThumbnail
  playlist: MVideoPlaylistThumbnail
}) {
  const { playlist, sourceThumbnail } = options
  const { filename, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist)

  const thumbnail = buildThumbnailModel({
    automaticallyGenerated: true,
    existingThumbnail,
    filename,
    height,
    type: ThumbnailType.MINIATURE,
    width
  })

  thumbnail.storage = FileStorage.OBJECT_STORAGE
  thumbnail.fileUrl = await copyThumbnailFile(sourceThumbnail, thumbnail)

  return thumbnail
}

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
  const storage = CONFIG.OBJECT_STORAGE.ENABLED ? FileStorage.OBJECT_STORAGE : FileStorage.FILE_SYSTEM

  const thumbnailCreator = async () => {
    return await processImageFromWorker({
      source: inputPath,
      destination: outputPath,
      newSize: { width, height },
      keepOriginal
    })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    onDisk: storage === FileStorage.FILE_SYSTEM,
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
  const storage = CONFIG.OBJECT_STORAGE.ENABLED ? FileStorage.OBJECT_STORAGE : FileStorage.FILE_SYSTEM

  // Only save the file URL if it is a remote playlist
  const fileUrl = playlist.isOwned()
    ? null
    : downloadUrl

  const thumbnailCreator = async () => {
    return await downloadImageFromWorker({
      url: downloadUrl,
      destDir: basePath,
      destName: filename,
      size: { width, height },
      saveOnDisk: storage === FileStorage.FILE_SYSTEM
    })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    existingThumbnail,
    fileUrl,
    onDisk: storage === FileStorage.FILE_SYSTEM
  })
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
  const storage = CONFIG.OBJECT_STORAGE.ENABLED ? FileStorage.OBJECT_STORAGE : FileStorage.FILE_SYSTEM

  const thumbnailCreator = async () => {
    return await processImageFromWorker({
      source: inputPath,
      destination: outputPath,
      newSize: { width, height },
      keepOriginal
    })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    existingThumbnail,
    onDisk: storage === FileStorage.FILE_SYSTEM
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

    let biggestImage: Buffer
    return Bluebird.mapSeries(metadatas, metadata => {
      const { filename, height, width, existingThumbnail, outputPath, type } = metadata

      const storage = CONFIG.OBJECT_STORAGE.ENABLED ? FileStorage.OBJECT_STORAGE : FileStorage.FILE_SYSTEM
      let thumbnailCreator: () => Promise<Buffer>

      if (videoFile.isAudio()) {
        thumbnailCreator = async () => await processImageFromWorker({
          source: ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND,
          destination: outputPath,
          newSize: { width, height },
          keepOriginal: true
        })
      } else if (biggestImage) {
        thumbnailCreator = async () => await processImageFromWorker({
          source: biggestImage,
          destination: outputPath,
          newSize: { width, height },
          keepOriginal: true
        })
      } else {
        thumbnailCreator = async () => {
          biggestImage = await generateImageFromVideoFile({
            fromPath: input,
            destination: outputPath,
            size: { height, width },
            ffprobe
          })

          return biggestImage
        }
      }

      return updateThumbnailFromFunction({
        thumbnailCreator,
        filename,
        height,
        width,
        type,
        automaticallyGenerated: true,
        onDisk: storage === FileStorage.FILE_SYSTEM,
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
  const storage = CONFIG.OBJECT_STORAGE.ENABLED ? FileStorage.OBJECT_STORAGE : FileStorage.FILE_SYSTEM

  // Do not change the thumbnail filename if the file did not change
  const filename = thumbnailUrlChanged
    ? updatedFilename
    : existingThumbnail.filename

  const thumbnailCreator = async () => {
    if (thumbnailUrlChanged) {
      return await downloadImageFromWorker({
        url: downloadUrl,
        destDir: basePath,
        destName: filename,
        size: { width, height },
        saveOnDisk: storage === FileStorage.FILE_SYSTEM
      })
    }

    return Promise.resolve(undefined)
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    existingThumbnail,
    fileUrl,
    onDisk: storage === FileStorage.FILE_SYSTEM
  })
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

function buildMetadataFromPlaylist (playlist: MVideoPlaylistThumbnail, size?: ImageSize) {
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
      outputPath: CONFIG.OBJECT_STORAGE.ENABLED ? null : join(basePath, filename),
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
      outputPath: CONFIG.OBJECT_STORAGE.ENABLED ? null : join(basePath, filename),
      height: size ? size.height : PREVIEWS_SIZE.height,
      width: size ? size.width : PREVIEWS_SIZE.width
    }
  }

  return undefined
}

async function updateThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<Buffer>
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
    existingThumbnail,
    onDisk,
    automaticallyGenerated = null,
    fileUrl = null
  } = parameters

  const thumbnail = buildThumbnailModel({
    automaticallyGenerated,
    existingThumbnail,
    filename,
    height,
    type: ThumbnailType.MINIATURE,
    width
  })

  const thumbnailDestination = await thumbnailCreator()

  if (onDisk) {
    thumbnail.fileUrl = fileUrl
    thumbnail.storage = FileStorage.FILE_SYSTEM
  } else {
    thumbnail.storage = FileStorage.OBJECT_STORAGE
    thumbnail.fileUrl = await storeThumbnailFile(thumbnailDestination, thumbnail)
  }

  return thumbnail
}

function buildThumbnailModel (options: {
  automaticallyGenerated: boolean
  existingThumbnail?: MThumbnail
  filename: string
  height: number
  type: ThumbnailType_Type
  width: number
}) {
  const { automaticallyGenerated, existingThumbnail, filename, height, type, width } = options

  const oldFilename = existingThumbnail && existingThumbnail.filename !== filename
    ? existingThumbnail.filename
    : undefined

  const thumbnail: MThumbnail = existingThumbnail || new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.automaticallyGenerated = automaticallyGenerated
  thumbnail.onDisk = false

  if (oldFilename) thumbnail.previousThumbnailFilename = oldFilename

  return thumbnail
}

async function generateImageFromVideoFile (options: {
  fromPath: string
  destination: string
  size: { width: number, height: number }
  ffprobe?: FfprobeData
}) {
  const { destination, fromPath, size, ffprobe } = options

  try {
    const framesToAnalyze = CONFIG.THUMBNAILS.GENERATION_FROM_VIDEO.FRAMES_TO_ANALYZE
    const thumbnailSource = await generateThumbnailFromVideo({
      fromPath,
      output: null,
      framesToAnalyze,
      ffprobe,
      scale: size
    })

    return processImageFromWorker({
      source: thumbnailSource,
      destination,
      newSize: size
    })
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err, ...lTags() })

    throw err
  }
}
