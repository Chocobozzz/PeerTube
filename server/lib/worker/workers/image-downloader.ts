import { remove } from 'fs-extra'
import { join } from 'path'
import { processImage } from '@server/helpers/image-utils'
import { doRequestAndSaveToFile } from '@server/helpers/requests'
import { CONFIG } from '@server/initializers/config'

async function downloadImage (options: {
  url: string
  destDir: string
  destName: string
  size: { width: number, height: number }
}) {
  const { url, destDir, destName, size } = options

  const tmpPath = join(CONFIG.STORAGE.TMP_DIR, 'pending-' + destName)
  await doRequestAndSaveToFile(url, tmpPath)

  const destPath = join(destDir, destName)

  try {
    await processImage({ path: tmpPath, destination: destPath, newSize: size })
  } catch (err) {
    await remove(tmpPath)

    throw err
  }

  return destPath
}

module.exports = downloadImage

export {
  downloadImage
}
