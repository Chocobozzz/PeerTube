import { FileStorage } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { FILES_CACHE } from '@server/initializers/constants.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { emptyDir } from 'fs-extra/esm'
import { QueryTypes } from 'sequelize'

const logger = createLogger('lazy-load')

// Same as tables of abstract file cache
const cachedFileTables = [ 'actorImage', 'thumbnail', 'storyboard', 'videoCaption' ]

export async function resetFilesCacheOfOtherStorage () {
  const isEnabled = CONFIG.OBJECT_STORAGE.ENABLED === true

  const otherStorage = isEnabled
    ? FileStorage.FILE_SYSTEM
    : FileStorage.OBJECT_STORAGE

  let resetCount = 0

  for (const table of cachedFileTables) {
    const [ , affectedCount ] = await sequelizeTypescript.query(
      `UPDATE "${table}" SET "cached" = false WHERE "cached" IS TRUE AND "fileUrl" IS NOT NULL AND "storage" = $storage`,
      { type: QueryTypes.UPDATE, bind: { storage: otherStorage } }
    )

    resetCount += affectedCount
  }

  if (resetCount !== 0) {
    logger.info(`Object storage has been ${isEnabled ? 'enabled' : 'disabled'}: reset the cache of ${resetCount} remote files.`)
  }

  if (otherStorage === FileStorage.FILE_SYSTEM) {
    for (const { DIRECTORY } of Object.values(FILES_CACHE)) {
      await emptyDir(DIRECTORY)
    }

    return
  }

  if (resetCount === 0) return

  // Object storage is disabled, so PeerTube cannot remove them
  logger.warn(
    'Cached remote files are still in object storage: you can remove the objects of bucket %s with prefix %s.',
    CONFIG.OBJECT_STORAGE.CACHE.BUCKET_NAME,
    CONFIG.OBJECT_STORAGE.CACHE.PREFIX
  )
}
