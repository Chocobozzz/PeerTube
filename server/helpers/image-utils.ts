import { remove, rename } from 'fs-extra'
import { convertWebPToJPG } from './ffmpeg-utils'
import { logger } from './logger'

const Jimp = require('jimp')

async function processImage (
  path: string,
  destination: string,
  newSize: { width: number, height: number },
  keepOriginal = false
) {
  if (path === destination) {
    throw new Error('Jimp needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

  let jimpInstance: any

  try {
    jimpInstance = await Jimp.read(path)
  } catch (err) {
    logger.debug('Cannot read %s with jimp. Try to convert the image using ffmpeg first.', { err })

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
