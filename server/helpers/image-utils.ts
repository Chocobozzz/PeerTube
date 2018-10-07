import 'multer'
import * as sharp from 'sharp'
import { remove } from 'fs-extra'

async function processImage (
  physicalFile: { path: string },
  destination: string,
  newSize: { width: number, height: number }
) {
  await sharp(physicalFile.path)
    .resize(newSize.width, newSize.height)
    .toFile(destination)

  await remove(physicalFile.path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}
