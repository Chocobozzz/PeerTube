import 'multer'
import * as sharp from 'sharp'
import { unlinkPromise } from './core-utils'

async function processImage (
  physicalFile: Express.Multer.File,
  destination: string,
  newSize: { width: number, height: number }
) {
  await sharp(physicalFile.path)
    .resize(newSize.width, newSize.height)
    .toFile(destination)

  await unlinkPromise(physicalFile.path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}
