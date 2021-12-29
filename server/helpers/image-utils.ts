import { copy, readFile, remove, rename } from 'fs-extra'
import Jimp, { read } from 'jimp'
import { getLowercaseExtension } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { convertWebPToJPG, processGIF } from './ffmpeg-utils'
import { logger } from './logger'

function generateImageFilename (extension = '.jpg') {
  return buildUUID() + extension
}

async function processImage (
  path: string,
  destination: string,
  newSize: { width: number, height: number },
  keepOriginal = false
) {
  const extension = getLowercaseExtension(path)

  if (path === destination) {
    throw new Error('Jimp/FFmpeg needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

  // Use FFmpeg to process GIF
  if (extension === '.gif') {
    await processGIF(path, destination, newSize)
  } else {
    await jimpProcessor(path, destination, newSize, extension)
  }

  if (keepOriginal !== true) await remove(path)
}

// ---------------------------------------------------------------------------

export {
  generateImageFilename,
  processImage
}

// ---------------------------------------------------------------------------

async function jimpProcessor (path: string, destination: string, newSize: { width: number, height: number }, inputExt: string) {
  let sourceImage: Jimp
  const inputBuffer = await readFile(path)

  try {
    sourceImage = await read(inputBuffer)
  } catch (err) {
    logger.debug('Cannot read %s with jimp. Try to convert the image using ffmpeg first.', path, { err })

    const newName = path + '.jpg'
    await convertWebPToJPG(path, newName)
    await rename(newName, path)

    sourceImage = await read(path)
  }

  await remove(destination)

  // Optimization if the source file has the appropriate size
  const outputExt = getLowercaseExtension(destination)
  if (skipProcessing({ sourceImage, newSize, imageBytes: inputBuffer.byteLength, inputExt, outputExt })) {
    return copy(path, destination)
  }

  await autoResize({ sourceImage, newSize, destination })
}

async function autoResize (options: {
  sourceImage: Jimp
  newSize: { width: number, height: number }
  destination: string
}) {
  const { sourceImage, newSize, destination } = options

  // Portrait mode targetting a landscape, apply some effect on the image
  const sourceIsPortrait = sourceImage.getWidth() < sourceImage.getHeight()
  const destIsPortraitOrSquare = newSize.width <= newSize.height

  if (sourceIsPortrait && !destIsPortraitOrSquare) {
    const baseImage = sourceImage.cloneQuiet().cover(newSize.width, newSize.height)
                                              .color([ { apply: 'shade', params: [ 50 ] } ])

    const topImage = sourceImage.cloneQuiet().contain(newSize.width, newSize.height)

    return write(baseImage.blit(topImage, 0, 0), destination)
  }

  return write(sourceImage.cover(newSize.width, newSize.height), destination)
}

function write (image: Jimp, destination: string) {
  return image.quality(80).writeAsync(destination)
}

function skipProcessing (options: {
  sourceImage: Jimp
  newSize: { width: number, height: number }
  imageBytes: number
  inputExt: string
  outputExt: string
}) {
  const { sourceImage, newSize, imageBytes, inputExt, outputExt } = options
  const { width, height } = newSize

  if (sourceImage.getWidth() > width || sourceImage.getHeight() > height) return false
  if (inputExt !== outputExt) return false

  const kB = 1000

  if (height >= 1000) return imageBytes <= 200 * kB
  if (height >= 500) return imageBytes <= 100 * kB

  return imageBytes <= 15 * kB
}
