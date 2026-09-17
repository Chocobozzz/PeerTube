import { sortBy } from '@peertube/peertube-core-utils'
import { FileStorage, ThumbnailAspectRatio, VideoFileStream } from '@peertube/peertube-models'
import { generateThumbnailFromVideo } from '@server/helpers/ffmpeg/ffmpeg-image.js'
import { createLogger } from '@server/helpers/logger.js'
import Bluebird from 'bluebird'
import { FfprobeData } from 'fluent-ffmpeg'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { generateImageFilename, processImage } from '../helpers/image-utils.js'
import { CONFIG } from '../initializers/config.js'
import { ASSETS_PATH, MIMETYPES } from '../initializers/constants.js'
import { ThumbnailModel } from '../models/video/thumbnail.js'
import { MVideoFile, MVideoThumbnails, MVideoUUID, MVideoWithAllFiles } from '../types/models/index.js'
import { MThumbnail } from '../types/models/video/thumbnail.js'
import { MVideoPlaylistThumbnail } from '../types/models/video/video-playlist.js'
import downloadImage from './image-downloader.js'
import { removeCommonFileObjectStorage, storeCommonFile } from './object-storage/common-files.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger('thumbnail')

type ImageSize = { height: number, width: number, aspectRatio: ThumbnailAspectRatio }
type ThumbnailMetadata = ReturnType<typeof buildMetadataFromVideo>

export function createLocalPlaylistThumbnailsFromImage (options: {
  inputPath: string
  playlist: MVideoPlaylistThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, playlist, automaticallyGenerated, keepOriginal = false } = options

  const extension = getImageExtension(inputPath)
  const metadata = CONFIG.THUMBNAILS.SIZES.map(size => buildMetadataFromPlaylist({ playlist, size, extension }))

  return createThumbnailBatch({
    metadata,
    create: (metadata, i) => {
      return _createLocalPlaylistThumbnailFromImage({
        inputPath,
        metadata,
        automaticallyGenerated,
        // Keep original image until the last thumbnail is generated
        keepOriginal: keepOriginal || i !== CONFIG.THUMBNAILS.SIZES.length - 1
      })
    }
  })
}

function _createLocalPlaylistThumbnailFromImage (options: {
  inputPath: string
  metadata: ThumbnailMetadata
  automaticallyGenerated: boolean
  keepOriginal: boolean
}) {
  const { inputPath, metadata, automaticallyGenerated, keepOriginal } = options

  const { filename, outputPath, height, width, aspectRatio } = metadata

  const thumbnailCreator = () => {
    return processImage({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    outputPath,
    height,
    width,
    aspectRatio,
    automaticallyGenerated,
    cached: false
  })
}

export function updateRemotePlaylistThumbnailFromUrl (options: {
  fileUrl: string
  playlist: MVideoPlaylistThumbnail
  size: ImageSize
}) {
  const { fileUrl, playlist, size } = options

  const extension = getImageExtension(fileUrl)

  const { filename: generatedFilename, height, width, aspectRatio, existingThumbnail } = buildMetadataFromPlaylist({
    playlist,
    size,
    extension
  })

  // Only change thumbnail filename if the file changed
  if (hasThumbnailUrlChanged({ existingThumbnail, fileUrl, extension })) {
    if (existingThumbnail) {
      logger.debug(
        `Remote thumbnail changed for playlist ${playlist.url}, ` +
          `updating filename from ${existingThumbnail.filename} to ${generatedFilename}`
      )
    }

    const thumbnail = new ThumbnailModel()

    thumbnail.filename = generatedFilename
    thumbnail.height = height
    thumbnail.width = width
    thumbnail.aspectRatio = aspectRatio
    thumbnail.fileUrl = fileUrl
    thumbnail.cached = false

    return thumbnail
  }

  existingThumbnail.height = height
  existingThumbnail.width = width
  existingThumbnail.aspectRatio = aspectRatio

  return existingThumbnail
}

// ---------------------------------------------------------------------------

export async function createLocalVideoThumbnailsFromImage (options: {
  inputPath: string
  video: MVideoThumbnails
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, automaticallyGenerated, video, keepOriginal = false } = options

  const extension = getImageExtension(inputPath)
  const metadata = CONFIG.THUMBNAILS.SIZES.map(size => buildMetadataFromVideo({ video, size, extension }))

  const thumbnails = await createThumbnailBatch({
    metadata,
    // We'll delete origin file ourselves after all thumbnails are generated, to avoid deleting it before generating all thumbnails
    create: metadata => _createLocalVideoThumbnailFromImage({ inputPath, metadata, automaticallyGenerated, keepOriginal: true })
  })

  if (!keepOriginal) {
    try {
      await remove(inputPath)
    } catch (err) {
      logger.error('Cannot remove original image after thumbnail generation.', { err })
    }
  }

  return thumbnails
}

function _createLocalVideoThumbnailFromImage (options: {
  inputPath: string
  metadata: ThumbnailMetadata
  automaticallyGenerated: boolean
  keepOriginal: boolean
}) {
  const { inputPath, metadata, automaticallyGenerated, keepOriginal } = options

  const { filename, outputPath, height, width, aspectRatio } = metadata

  const thumbnailCreator = () => {
    return processImage({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    outputPath,
    height,
    width,
    aspectRatio,
    automaticallyGenerated,
    cached: false
  })
}

// ---------------------------------------------------------------------------

// Returns thumbnail models sorted by their size (height) in descendent order (biggest first)
export function createLocalVideoThumbnailsFromVideo (options: {
  video: MVideoThumbnails
  videoFile: MVideoFile
  ffprobe: FfprobeData
}): Promise<MThumbnail[]> {
  const { video, videoFile, ffprobe } = options

  return VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), input => {
    const metadata = CONFIG.THUMBNAILS.SIZES.map(size => buildMetadataFromVideo({ video, size, extension: '.jpg' }))

    let biggestImagePath: string

    return createThumbnailBatch({
      // Get bigger images to generate first
      metadata: sortBy(metadata, 'width').reverse(),
      // Smaller images are generated from the biggest one
      sequential: true,

      create: metadata => {
        const { filename, basePath, height, width, aspectRatio, outputPath } = metadata

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

        if (!biggestImagePath && aspectRatio === '16:9') {
          biggestImagePath = outputPath
        }

        return createThumbnailFromFunction({
          thumbnailCreator,
          filename,
          outputPath,
          height,
          width,
          aspectRatio,
          automaticallyGenerated: true,
          cached: false
        })
      }
    })
  })
}

// ---------------------------------------------------------------------------

export function createLocalVideoThumbnailsFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnails
}) {
  const { downloadUrl, video } = options

  const extension = getImageExtension(downloadUrl)
  const metadata = CONFIG.THUMBNAILS.SIZES.map(size => buildMetadataFromVideo({ video, size, extension }))

  return createThumbnailBatch({
    metadata,
    create: metadata => _createLocalVideoThumbnailFromUrl({ downloadUrl, metadata })
  })
}

function _createLocalVideoThumbnailFromUrl (options: {
  downloadUrl: string
  metadata: ThumbnailMetadata
}) {
  const { downloadUrl, metadata } = options

  const { filename, basePath, outputPath, height, width, aspectRatio } = metadata

  const thumbnailCreator = () => {
    return downloadImage({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
  }

  return createThumbnailFromFunction({ thumbnailCreator, filename, outputPath, height, width, aspectRatio, cached: false })
}

// ---------------------------------------------------------------------------

export function updateRemoteVideoThumbnail (options: {
  fileUrl: string
  video: MVideoThumbnails
  size: ImageSize
}) {
  const { fileUrl, video, size } = options

  const extension = getImageExtension(fileUrl)
  const { filename: generatedFilename, height, width, aspectRatio, existingThumbnail } = buildMetadataFromVideo({ video, size, extension })

  if (hasThumbnailUrlChanged({ existingThumbnail, fileUrl, video, extension })) {
    if (existingThumbnail) {
      logger.debug(
        `Remote thumbnail changed for video ${video.url}, updating filename from ${existingThumbnail.filename} to ${generatedFilename}`
      )
    }

    const thumbnail = new ThumbnailModel()

    thumbnail.filename = generatedFilename
    thumbnail.height = height
    thumbnail.width = width
    thumbnail.aspectRatio = aspectRatio
    thumbnail.fileUrl = fileUrl
    thumbnail.cached = false

    return thumbnail
  }

  // Update sizes, that PeerTube did not federate in previous versions
  existingThumbnail.height = height
  existingThumbnail.width = width
  existingThumbnail.aspectRatio = aspectRatio

  return existingThumbnail
}

// ---------------------------------------------------------------------------

export async function regenerateLocalVideoThumbnailsFromVideoIfNeeded (video: MVideoWithAllFiles, ffprobe: FfprobeData) {
  if (video.Thumbnails.some(t => t.automaticallyGenerated === false)) return

  logger.info('Re-generate thumbnails for video ' + video.url)

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
  const basePath = buildThumbnailBasePath()

  return {
    filename,
    basePath,
    existingThumbnail: Array.isArray(playlist.Thumbnails)
      ? playlist.Thumbnails.find(t => t.height === size.height && t.width === size.width)
      : undefined,
    outputPath: join(basePath, filename),
    height: size.height,
    width: size.width,
    aspectRatio: size.aspectRatio
  }
}

function buildMetadataFromVideo (options: {
  video: MVideoThumbnails
  size: ImageSize
  extension: string
}) {
  const { video, extension, size } = options

  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.height === size.height && t.width === size.width)
    : undefined

  const filename = generateImageFilename(extension)
  const basePath = buildThumbnailBasePath()

  return {
    filename,
    basePath,
    existingThumbnail,
    outputPath: join(basePath, filename),
    height: size.height,
    width: size.width,
    aspectRatio: size.aspectRatio
  }
}

async function createThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>
  filename: string
  outputPath: string
  height: number
  width: number
  aspectRatio: ThumbnailAspectRatio
  cached: boolean
  automaticallyGenerated?: boolean
  fileUrl?: string
}) {
  const {
    thumbnailCreator,
    filename,
    outputPath,
    width,
    height,
    aspectRatio,
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
  thumbnail.aspectRatio = aspectRatio
  thumbnail.storage = FileStorage.FILE_SYSTEM

  await thumbnailCreator()

  if (CONFIG.OBJECT_STORAGE.THUMBNAILS.ENABLED) {
    await storeCommonFile('thumbnails', outputPath, filename)
    thumbnail.storage = FileStorage.OBJECT_STORAGE
  }

  return thumbnail
}

// Generated thumbnails are written to tmp when they belong to object storage, so that we can still downscale one thumbnail from another
function buildThumbnailBasePath () {
  return CONFIG.OBJECT_STORAGE.THUMBNAILS.ENABLED
    ? CONFIG.STORAGE.TMP_DIR
    : CONFIG.STORAGE.THUMBNAILS_DIR
}

async function createThumbnailBatch (options: {
  metadata: ThumbnailMetadata[]
  sequential?: boolean // default to false
  create: (metadata: ThumbnailMetadata, index: number) => Promise<MThumbnail>
}) {
  const { metadata, sequential = false, create } = options

  const onObjectStorage = CONFIG.OBJECT_STORAGE.THUMBNAILS.ENABLED

  // When one thumbnail of a batch fails, don't leave the files and objects of the other ones behind
  // On success, the tmp files of thumbnails uploaded to object storage are not needed anymore
  try {
    const thumbnails = sequential
      ? await Bluebird.mapSeries(metadata, create)
      : await createAllOrThrow(metadata.map(create))

    if (onObjectStorage) await removeThumbnailFiles(metadata)

    return thumbnails
  } catch (err) {
    await removeThumbnailFiles(metadata)

    if (onObjectStorage) {
      for (const { filename } of metadata) {
        await removeCommonFileObjectStorage('thumbnails', filename)
          .catch(err => logger.error('Cannot remove thumbnail %s from object storage.', filename, { err }))
      }
    }

    throw err
  }
}

async function createAllOrThrow (promises: Promise<MThumbnail>[]) {
  // Wait for every thumbnail before throwing, so none of them is still being generated when the batch is cleaned up
  const results = await Promise.allSettled(promises)

  for (const result of results) {
    if (result.status === 'rejected') throw result.reason as Error
  }

  return results.map(r => (r as PromiseFulfilledResult<MThumbnail>).value)
}

async function removeThumbnailFiles (metadata: ThumbnailMetadata[]) {
  for (const { outputPath } of metadata) {
    try {
      await remove(outputPath)
    } catch (err) {
      logger.error('Cannot remove thumbnail file ' + outputPath, { err })
    }
  }
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
    logger.error('Cannot generate image from video %s.', fromPath, { err })

    try {
      await remove(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err })
    }

    throw err
  }
}

function getImageExtension (input: string) {
  const extension = extname(input).toLowerCase()

  if (MIMETYPES.IMAGE.EXT_MIMETYPE[extension]) return extension

  logger.warn('Cannot determine image extension from input ' + input)

  return '.jpg'
}
