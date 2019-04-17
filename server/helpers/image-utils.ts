import 'multer'
import * as sharp from 'sharp'
import { readFile, remove } from 'fs-extra'
import { logger } from './logger'

async function processImage (
  physicalFile: { path: string },
  destination: string,
  newSize: { width: number, height: number },
  keepOriginal = false
) {
  if (physicalFile.path === destination) {
    throw new Error('Sharp needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', physicalFile.path, destination)

  // Avoid sharp cache
  const buf = await readFile(physicalFile.path)
  const sharpInstance = sharp(buf)

  await remove(destination)

  await sharpInstance
    .resize(newSize.width, newSize.height)
    .toFile(destination)

  if (keepOriginal !== true) await remove(physicalFile.path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}
