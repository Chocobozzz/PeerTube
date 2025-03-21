import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { processImage } from '@server/helpers/image-utils.js'
import { doRequestAndSaveToFile } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'

async function downloadImage (options: {
  url: string
  destDir: string
  destName: string
  size?: { width: number, height: number }
  saveOnDisk?: boolean
}) {
  const { url, destDir, destName, size, saveOnDisk = true } = options

  const tmpPath = join(CONFIG.STORAGE.TMP_DIR, 'pending-' + destName)
  await doRequestAndSaveToFile(url, tmpPath)

  const destination = saveOnDisk ? join(destDir, destName) : null

  try {
    return await processImage({
      source: tmpPath,
      destination,
      newSize: size
    })
  } catch (err) {
    await remove(tmpPath)

    throw err
  }
}

export default downloadImage
