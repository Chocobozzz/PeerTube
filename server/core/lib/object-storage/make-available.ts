import { buildUUID } from '@peertube/peertube-node-utils'
import { CONFIG } from '@server/initializers/config.js'
import { remove } from 'fs-extra/esm'
import { extname, join } from 'path'
import { BucketInfo, objectStorageLogger as logger, makeAvailable } from './shared/index.js'

// Download an object in the tmp directory, run `cb` on it and always clean up afterwards
export async function makeAvailableInTmp<T> (options: {
  key: string
  bucketInfo: BucketInfo
  filename: string
  cb: (path: string) => Promise<T>
}) {
  const { key, bucketInfo, filename, cb } = options

  const destination = join(CONFIG.STORAGE.TMP_DIR, buildUUID() + extname(filename))

  try {
    // Inside the try: a download failing in the middle leaves a partial file
    await makeAvailable({ key, destination, bucketInfo })

    return await cb(destination)
  } finally {
    try {
      await remove(destination)
    } catch (err) {
      logger.error('Cannot remove temporary file ' + destination, { err })
    }
  }
}
