import { extname } from 'path'
import { remove, rename } from 'fs-extra'
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

  // Use FFmpeg to process GIF
  if (extension === '.gif') {
    return processGIF(path, destination, newSize, keepOriginal)
  }

  if (path === destination) {
    throw new Error('Jimp needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

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

  if (keepOriginal !== true) await remove(path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}
