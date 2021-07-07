import { copy, readFile, remove, rename } from 'fs-extra'
import * as Jimp from 'jimp'
import { getLowercaseExtension } from './core-utils'
import { convertWebPToJPG, processGIF } from './ffmpeg-utils'
import { logger } from './logger'
import { buildUUID } from './uuid'

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
  let jimpInstance: Jimp
  const inputBuffer = await readFile(path)

  try {
    jimpInstance = await Jimp.read(inputBuffer)
  } catch (err) {
    logger.debug('Cannot read %s with jimp. Try to convert the image using ffmpeg first.', path, { err })

    const newName = path + '.jpg'
    await convertWebPToJPG(path, newName)
    await rename(newName, path)

    jimpInstance = await Jimp.read(path)
  }

  await remove(destination)

  // Optimization if the source file has the appropriate size
  const outputExt = getLowercaseExtension(destination)
  if (skipProcessing({ jimpInstance, newSize, imageBytes: inputBuffer.byteLength, inputExt, outputExt })) {
    return copy(path, destination)
  }

  await jimpInstance
    .resize(newSize.width, newSize.height)
    .quality(80)
    .writeAsync(destination)
}

function skipProcessing (options: {
  jimpInstance: Jimp
  newSize: { width: number, height: number }
  imageBytes: number
  inputExt: string
  outputExt: string
}) {
  const { jimpInstance, newSize, imageBytes, inputExt, outputExt } = options
  const { width, height } = newSize

  if (jimpInstance.getWidth() > width || jimpInstance.getHeight() > height) return false
  if (inputExt !== outputExt) return false

  const kB = 1000

  if (height >= 1000) return imageBytes <= 200 * kB
  if (height >= 500) return imageBytes <= 100 * kB

  return imageBytes <= 15 * kB
}
