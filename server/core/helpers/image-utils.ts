import { copy, remove } from 'fs-extra/esm'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { MIMETYPES } from '@server/initializers/constants.js'
import { processGIF } from './ffmpeg/index.js'
import { logger } from './logger.js'
import sharp from 'sharp'

export function generateImageFilename (extension = '.jpg') {
  return buildUUID() + extension
}

export async function processImage (options: {
  source: string | Buffer
  destination: string | null
  newSize?: { width: number, height: number }
  keepOriginal?: boolean // default false
}) {
  const { source, destination, newSize, keepOriginal = false } = options
  const sourcePath = typeof source === 'string' ? source : null

  const extension = sourcePath ? getLowercaseExtension(sourcePath) : '.jpg'

  if (source === destination) {
    throw new Error('sharp/FFmpeg needs an input path different than the output path.')
  }

  logger.debug('Processing image %s to %s.', sourcePath ?? 'from buffer', destination ?? 'to buffer')

  let processDestination

  // Use FFmpeg to process GIF
  if (extension === '.gif') {
    processDestination = await processGIF({ source, destination, newSize })
  } else {
    processDestination = await sharpProcessor({ source, destination, newSize, inputExt: extension })
  }

  if (keepOriginal !== true && !!sourcePath) await remove(sourcePath)

  logger.debug(
    'Finished processing image %s to %s.',
    sourcePath ?? 'from buffer', destination ?? 'to buffer'
  )

  return processDestination
}

export async function getImageSize (path: string) {
  const image = await sharp(path).metadata()

  return {
    width: image.width,
    height: image.height
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function sharpProcessor (options: {
  source: string | Buffer
  destination: string | null
  newSize?: {
    width: number
    height: number
  }
  inputExt: string
}): Promise<Buffer> {
  const { source, destination, newSize, inputExt } = options

  const sourceImage = sharp(source)
  const sourceImageMetadata = await sourceImage.metadata()

  // Optimization if the source file has the appropriate size
  const outputExt = typeof destination === 'string' ? getLowercaseExtension(destination) : null
  const mimeType = MIMETYPES.IMAGE.EXT_MIMETYPE[inputExt]
  // TODO: Remove null check, just for debug
  if (skipProcessing({ sourceImageMetadata, newSize, imageBytes: sourceImageMetadata.size, inputExt, outputExt }) && source === null) {
    if (destination === null) {
      return sourceImage.toFormat('jpg').toBuffer()
    }

    if (typeof source === 'string') {
      await copy(source, destination)
    } else {
      await write(sourceImage, destination)
    }

    return sourceImage.toFormat('jpg').toBuffer()
  }

  if (newSize) {
    const processedImage = await autoResize({ mimeType, sourceImage, sourceImageMetadata, newSize, destination })
    return processedImage.toFormat('jpg').toBuffer()
  }

  if (typeof destination === 'string') {
    await write(sourceImage, destination)
  }

  return sourceImage.toFormat('jpg').toBuffer()
}

async function autoResize (options: {
  sourceImage: sharp.Sharp
  sourceImageMetadata: sharp.Metadata
  mimeType: string
  newSize: { width: number, height: number }
  destination: string | null
}) {
  const { sourceImage, sourceImageMetadata, newSize, destination } = options

  // Portrait mode targeting a landscape, apply some effect on the image
  const sourceIsPortrait = sourceImageMetadata.width <= sourceImageMetadata.height
  const destIsPortraitOrSquare = newSize.width <= newSize.height

  let processedImage: sharp.Sharp

  if (sourceIsPortrait && !destIsPortraitOrSquare) {
    const portrait = await sourceImage.toBuffer()
    const background = await sourceImage
      .resize({ fit: 'cover', height: newSize.height, width: newSize.width })
      .modulate({ brightness: 0.5 })
      .toBuffer()

    processedImage = sharp(portrait)
      .resize({ width: newSize.width, height: newSize.height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .composite([ { blend: 'dest-over', input: background } ])
  } else {
    processedImage = sourceImage.resize(newSize.width, newSize.height)
  }

  if (typeof destination === 'string') {
    await write(processedImage, destination)
    return processedImage
  }

  return processedImage
}

function write (image: sharp.Sharp, destination: string) {
  return image.jpeg({ quality: 80 }).toFile(destination)
}

function skipProcessing (options: {
  sourceImageMetadata: sharp.Metadata
  newSize?: { width: number, height: number }
  imageBytes: number
  inputExt: string
  outputExt: string | null
}) {
  const { sourceImageMetadata, newSize, imageBytes, inputExt, outputExt } = options

  if (sourceImageMetadata.exif) return false
  if (newSize && (sourceImageMetadata.width !== newSize.width || sourceImageMetadata.height !== newSize.height)) return false
  if (outputExt !== null && inputExt !== outputExt) return false

  const kB = 1000

  if (newSize) {
    if (newSize.height >= 1000) return imageBytes <= 200 * kB
    if (newSize.height >= 500) return imageBytes <= 100 * kB
  }

  return imageBytes <= 15 * kB
}
