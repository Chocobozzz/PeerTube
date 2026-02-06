import { sortBy } from '@peertube/peertube-core-utils'
import { VideoFileStream } from '@peertube/peertube-models'
import { generateThumbnailFromVideo } from '@server/helpers/ffmpeg/ffmpeg-image.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import Bluebird from 'bluebird'
import { FfprobeData } from 'fluent-ffmpeg'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { generateImageFilename, processImage } from '../helpers/image-utils.js'
import { CONFIG } from '../initializers/config.js'
import { ASSETS_PATH, MIMETYPES } from '../initializers/constants.js'
import { ThumbnailModel } from '../models/video/thumbnail.js'
import { MVideoFile, MVideoThumbnail, MVideoUUID, MVideoWithAllFiles } from '../types/models/index.js'
import { MThumbnail } from '../types/models/video/thumbnail.js'
import { MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import { VideoPathManager } from './video-path-manager.js'
import { downloadImageFromWorker } from './worker/parent-process.js'

const lTags = loggerTagsFactory('thumbnail')

type ImageSize = { height: number, width: number }

export function createLocalPlaylistThumbnailFromImage (options: {
  inputPath: string
  playlist: MVideoPlaylistThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, playlist, automaticallyGenerated, keepOriginal = false } = options
  const size = CONFIG.THUMBNAILS.SIZES[0] // Minimum size

  const { filename, outputPath, height, width } = buildMetadataFromPlaylist({
    playlist,
    size,
    extension: getImageExtension(inputPath)
  })

  const thumbnailCreator = () => {
    return processImage({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    automaticallyGenerated,
    cached: false
  })
}

export function updateRemotePlaylistThumbnailFromUrl (options: {
  fileUrl: string
  playlist: MVideoPlaylistThumbnail
}) {
  const { fileUrl, playlist } = options
  const size = CONFIG.THUMBNAILS.SIZES[0] // Minimum size
  const extension = getImageExtension(fileUrl)

  const { filename: generatedFilename, height, width, existingThumbnail } = buildMetadataFromPlaylist({ playlist, size, extension })

  // Only change thumbnail filename if the file changed
  if (hasThumbnailUrlChanged({ existingThumbnail, fileUrl, extension })) {
    if (existingThumbnail) {
      logger.debug(
        `Remote thumbnail changed for playlist ${playlist.url}, ` +
          `updating filename from ${existingThumbnail.filename} to ${generatedFilename}`,
        lTags(playlist.uuid)
      )
    }

    const thumbnail = new ThumbnailModel()

    thumbnail.filename = generatedFilename
    thumbnail.height = height
    thumbnail.width = width
    thumbnail.fileUrl = fileUrl
    thumbnail.cached = false

    return thumbnail
  }

  existingThumbnail.height = height
  existingThumbnail.width = width

  return existingThumbnail
}

// ---------------------------------------------------------------------------

export function createLocalVideoThumbnailsFromImage (options: {
  inputPath: string
  video: MVideoThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, automaticallyGenerated, video, keepOriginal = false } = options

  return Promise.all(
    CONFIG.THUMBNAILS.SIZES.map(size =>
      _createLocalVideoThumbnailFromImage({ inputPath, video, automaticallyGenerated, size, keepOriginal })
    )
  )
}

function _createLocalVideoThumbnailFromImage (options: {
  inputPath: string
  video: MVideoThumbnail
  automaticallyGenerated: boolean
  size: ImageSize
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, video, automaticallyGenerated, size, keepOriginal = false } = options

  const { filename, outputPath, height, width } = buildMetadataFromVideo({
    video,
    size,
    extension: getImageExtension(inputPath)
  })

  const thumbnailCreator = () => {
    return processImage({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    automaticallyGenerated,
    cached: false
  })
}

// ---------------------------------------------------------------------------

// Returns thumbnail models sorted by their size (height) in descendent order (biggest first)
export function createLocalVideoThumbnailsFromVideo (options: {
  video: MVideoThumbnail
  videoFile: MVideoFile
  ffprobe: FfprobeData
}): Promise<MThumbnail[]> {
  const { video, videoFile, ffprobe } = options

  return VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), input => {
    const metadata = CONFIG.THUMBNAILS.SIZES.map(size => buildMetadataFromVideo({ video, size, extension: '.jpg' }))

    let biggestImagePath: string

    // Get bigger images to generate first
    return Bluebird.mapSeries(sortBy(metadata, 'height').reverse(), metadata => {
      const { filename, basePath, height, width, outputPath } = metadata

      let thumbnailCreator: () => Promise<any>

      if (videoFile.isAudio()) {
        thumbnailCreator = () =>
          processImage({
            path: ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND,
            destination: outputPath,
            newSize: { width, height },
            keepOriginal: true
          })
      } else if (biggestImagePath) {
        thumbnailCreator = () =>
          processImage({
            path: biggestImagePath,
            destination: outputPath,
            newSize: { width, height },
            keepOriginal: true
          })
      } else {
        thumbnailCreator = () =>
          generateImageFromVideoFile({
            fromPath: input,
            folder: basePath,
            imageName: filename,
            size: { height, width },
            ffprobe
          })
      }

      if (!biggestImagePath) biggestImagePath = outputPath

      return createThumbnailFromFunction({
        thumbnailCreator,
        filename,
        height,
        width,
        automaticallyGenerated: true,
        cached: false
      })
    })
  })
}

// ---------------------------------------------------------------------------

export function createLocalVideoThumbnailsFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnail
}) {
  const { downloadUrl, video } = options

  return Promise.all(
    CONFIG.THUMBNAILS.SIZES.map(size => _createLocalVideoThumbnailFromUrl({ downloadUrl, video, size }))
  )
}

function _createLocalVideoThumbnailFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnail
  size: ImageSize
}) {
  const { downloadUrl, video, size } = options

  const extension = getImageExtension(downloadUrl)
  const { filename, basePath, height, width } = buildMetadataFromVideo({ video, size, extension })

  const thumbnailCreator = () => {
    return downloadImageFromWorker({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
  }

  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, cached: false })
}

// ---------------------------------------------------------------------------

export function updateRemoteVideoThumbnail (options: {
  fileUrl: string
  video: MVideoThumbnail
  size: ImageSize
}) {
  const { fileUrl, video, size } = options

  const extension = getImageExtension(fileUrl)
  const { filename: generatedFilename, height, width, existingThumbnail } = buildMetadataFromVideo({ video, size, extension })

  if (hasThumbnailUrlChanged({ existingThumbnail, fileUrl, video, extension })) {
    if (existingThumbnail) {
      logger.debug(
        `Remote thumbnail changed for video ${video.url}, updating filename from ${existingThumbnail.filename} to ${generatedFilename}`,
        lTags(video.uuid)
      )
    }

    const thumbnail = new ThumbnailModel()

    thumbnail.filename = generatedFilename
    thumbnail.height = height
    thumbnail.width = width
    thumbnail.fileUrl = fileUrl
    thumbnail.cached = false

    return thumbnail
  }

  // Update sizes, that PeerTube did not federate in previous versions
  existingThumbnail.height = height
  existingThumbnail.width = width

  return existingThumbnail
}

// ---------------------------------------------------------------------------

export async function regenerateLocalVideoThumbnailsFromVideoIfNeeded (video: MVideoWithAllFiles, ffprobe: FfprobeData) {
  if (video.Thumbnails.some(t => t.automaticallyGenerated === false)) return

  logger.info('Re-generate thumbnails for video ' + video.url, lTags(video.uuid))

  const thumbnails = await createLocalVideoThumbnailsFromVideo({
    video,
    videoFile: video.getMaxQualityFile(VideoFileStream.VIDEO) || video.getMaxQualityFile(VideoFileStream.AUDIO),
    ffprobe
  })

  await video.replaceAndSaveThumbnails(thumbnails)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function hasThumbnailUrlChanged (options: {
  existingThumbnail: MThumbnail
  fileUrl: string
  extension: string
  video?: MVideoUUID
}) {
  const { existingThumbnail, fileUrl, extension, video } = options

  if (!existingThumbnail) return true

  // If the thumbnail URL did not change
  const existingUrl = existingThumbnail.fileUrl
  if (!existingUrl || existingUrl !== fileUrl) return true

  // Or has a unique filename (PeerTube <= 3.1)
  if (video && fileUrl.endsWith(`${video.uuid}.jpg`)) return true

  // Or the extension changed
  if (extname(existingThumbnail.filename).toLowerCase() !== extension) return true

  return false
}

function buildMetadataFromPlaylist (options: {
  playlist: MVideoPlaylistThumbnail
  extension: string
  size: ImageSize
}) {
  const { playlist, extension, size } = options

  const filename = playlist.generateThumbnailName(extension)

  return {
    filename,
    basePath: CONFIG.STORAGE.THUMBNAILS_DIR,
    existingThumbnail: playlist.Thumbnail,
    outputPath: join(CONFIG.STORAGE.THUMBNAILS_DIR, filename),
    height: size.height,
    width: size.width
  }
}

function buildMetadataFromVideo (options: {
  video: MVideoThumbnail
  size: ImageSize
  extension: string
}) {
  const { video, extension, size } = options

  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.height === size.height && t.width === size.width)
    : undefined

  const filename = generateImageFilename(extension)

  return {
    filename,
    basePath: CONFIG.STORAGE.THUMBNAILS_DIR,
    existingThumbnail,
    outputPath: join(CONFIG.STORAGE.THUMBNAILS_DIR, filename),
    height: size.height,
    width: size.width
  }
}

async function createThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>
  filename: string
  height: number
  width: number
  cached: boolean
  automaticallyGenerated?: boolean
  fileUrl?: string
}) {
  const {
    thumbnailCreator,
    filename,
    width,
    height,
    cached,
    automaticallyGenerated = null,
    fileUrl = null
  } = parameters

  const thumbnail: MThumbnail = new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.fileUrl = fileUrl
  thumbnail.automaticallyGenerated = automaticallyGenerated
  thumbnail.cached = cached

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
    await processImage({ path: pendingImagePath, destination, newSize: size })

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

function getImageExtension (input: string) {
  const extension = extname(input).toLowerCase()

  if (MIMETYPES.IMAGE.EXT_MIMETYPE[extension]) return extension

  logger.warn('Cannot determine image extension from input ' + input, lTags())

  return '.jpg'
}
