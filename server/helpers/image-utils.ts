import 'multer'
import * as sharp from 'sharp'
import { move, remove } from 'fs-extra'

async function processImage (
  physicalFile: { path: string },
  destination: string,
  newSize: { width: number, height: number }
) {
  if (physicalFile.path === destination) {
    throw new Error('Sharp needs an input path different that the output path.')
  }

  const sharpInstance = sharp(physicalFile.path)
  const metadata = await sharpInstance.metadata()

  // No need to resize
  if (metadata.width === newSize.width && metadata.height === newSize.height) {
    await move(physicalFile.path, destination, { overwrite: true })
    return
  }

  await remove(destination)

  await sharpInstance
    .resize(newSize.width, newSize.height)
    .toFile(destination)

  await remove(physicalFile.path)
}

// ---------------------------------------------------------------------------

export {
  processImage
}
