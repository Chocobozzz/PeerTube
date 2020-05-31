import 'multer'
import { readFile, remove } from 'fs-extra'
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

  // Avoid sharp cache
  const buf = await readFile(path)
  const jimpInstance = await Jimp.read(buf)

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
