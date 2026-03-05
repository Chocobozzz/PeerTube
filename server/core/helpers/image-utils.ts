import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { copy, remove } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import sharp from 'sharp'
import { logger } from './logger.js'

export function generateImageFilename (extension = '.jpg') {
  return buildUUID() + extension
}

export async function processImage (options: {
  path: string
  destination: string
  newSize?: { width: number, height: number }
  keepOriginal?: boolean // default false
}) {
  const { path, destination, newSize, keepOriginal = false } = options

  const extension = getLowercaseExtension(path)

  if (path === destination) {
    throw new Error('Input path must be different from output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

  await sharpProcessor({ path, destination, newSize, inputExt: extension, animated: extension.toLowerCase() === '.gif' })

  if (keepOriginal !== true) await remove(path)

  logger.debug('Finished processing image %s to %s.', path, destination)
}

export async function getImageSize (path: string) {
  const metadata = await sharp(path).metadata()

  return {
    width: metadata.width,
    height: metadata.height
  }
}

// Build new size if height or width is missing, to keep the aspect ratio
export async function buildImageSize (imagePath: string, sizeArg: { width?: number, height?: number }) {
  if (sizeArg.width && sizeArg.height) {
    return sizeArg as { width: number, height: number }
  }

  const size = await getImageSize(imagePath)
  const ratio = size.width / size.height

  return {
    width: sizeArg.width ?? Math.round(sizeArg.height * ratio),
    height: sizeArg.height ?? Math.round(sizeArg.width / ratio)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function sharpProcessor (options: {
  path: string
  destination: string
  newSize?: {
    width: number
    height: number
  }
  inputExt: string
  animated: boolean
}) {
  const { path, newSize, inputExt, destination, animated } = options

  const inputBuffer = await readFile(path)

  const sharpInstance = buildSharp({
    inputBuffer,
    animated
  })

  const metadata = await sharpInstance.metadata()

  if (metadata.pages > 200) {
    logger.info('Too much frames in animated image ' + path + ', skipping animation')

    return sharpProcessor({ ...options, animated: false })
  }

  await remove(destination)

  // Optimization if the source file has the appropriate size

  if (
    skipProcessing({
      metadata,
      newSize,
      imageBytes: inputBuffer.byteLength,
      inputExt,
      outputExt: getLowercaseExtension(destination)
    })
  ) {
    return copy(path, destination)
  }

  if (newSize) {
    await autoResize({ sharpInstance, metadata, newSize, destination })
  } else {
    await writeSharp({ sharpInstance, destination })
  }
}

async function autoResize (options: {
  sharpInstance: sharp.Sharp
  metadata: sharp.Metadata
  newSize: { width: number, height: number }
  destination: string
}) {
  const { sharpInstance, metadata, newSize, destination } = options

  // Portrait mode targeting a landscape, apply some effect on the image
  const sourceIsPortrait = metadata.width <= metadata.height
  const destIsPortraitOrSquare = newSize.width <= newSize.height

  if (sourceIsPortrait && !destIsPortraitOrSquare) {
    const foregroundImage = sharpInstance.clone()
      .resize(newSize.width, newSize.height, { fit: 'inside' })

    return writeSharp({
      sharpInstance: sharpInstance
        .resize(newSize.width, newSize.height, { fit: 'cover' })
        .modulate({ brightness: 0.5 })
        .composite([ { input: await foregroundImage.toBuffer(), gravity: 'center' } ]),

      destination
    })
  }

  return writeSharp({
    sharpInstance: sharpInstance
      .resize(newSize.width, newSize.height, { fit: 'cover' }),

    destination
  })
}

function skipProcessing (options: {
  metadata: sharp.Metadata
  newSize?: { width: number, height: number }
  imageBytes: number
  inputExt: string
  outputExt: string
}) {
  const { metadata, newSize, imageBytes, inputExt, outputExt } = options

  if (metadata.exif) return false
  if (newSize && (metadata.width !== newSize.width || metadata.height !== newSize.height)) return false
  if (inputExt !== outputExt) return false

  const kB = 1000

  if (newSize) {
    if (newSize.height >= 1000) return imageBytes <= 200 * kB
    if (newSize.height >= 500) return imageBytes <= 100 * kB
  }

  return imageBytes <= 15 * kB
}

function buildSharp (options: {
  inputBuffer: Buffer
  animated: boolean
}) {
  const { inputBuffer, animated } = options

  return sharp(inputBuffer, { animated })
}

function writeSharp (options: {
  sharpInstance: sharp.Sharp
  destination: string
}) {
  const { sharpInstance, destination } = options

  if (destination.endsWith('.jpg')) {
    return sharpInstance
      .jpeg({ quality: 85 }) // mozjpeg option seems to cause some issues to ffmpeg (probe difficulties), so prefer to not enable it
      .toFile(destination)
  }

  if (destination.endsWith('.png')) {
    return sharpInstance
      .png({ palette: true })
      .toFile(destination)
  }

  return sharpInstance.toFile(destination)
}
