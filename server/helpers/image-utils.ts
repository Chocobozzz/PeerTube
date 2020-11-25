import { remove, rename } from 'fs-extra'
import { extname } from 'path'
import { convertWebPToJPG, processGIF } from './ffmpeg-utils'
import { logger } from './logger'

const Jimp = require('jimp')

async function processImage (
  path: string,
  destination: string,
  newSize: { width: number, height: number },
  keepOriginal = false
) {
  const extension = extname(path)

  if (path === destination) {
    throw new Error('Jimp/FFmpeg needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

  // Use FFmpeg to process GIF
  if (extension === '.gif') {
    await processGIF(path, destination, newSize)
  } else {
    await jimpProcessor(path, destination, newSize)
  }

  if (keepOriginal !== true) await remove(path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}

// ---------------------------------------------------------------------------

async function jimpProcessor (path: string, destination: string, newSize: { width: number, height: number }) {
  let jimpInstance: any

  try {
    jimpInstance = await Jimp.read(path)
  } catch (err) {
    logger.debug('Cannot read %s with jimp. Try to convert the image using ffmpeg first.', path, { err })

    const newName = path + '.jpg'
    await convertWebPToJPG(path, newName)
    await rename(newName, path)

    jimpInstance = await Jimp.read(path)
  }

  await remove(destination)

  await jimpInstance
    .resize(newSize.width, newSize.height)
    .quality(80)
    .writeAsync(destination)
}
