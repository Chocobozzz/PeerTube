import { readdir, unlink, stat } from 'fs-extra'
import { Stats } from 'node:fs'
import * as path from 'path'
import { logger } from '@server/helpers/logger'
import { getTmpPath } from '@server/helpers/utils'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants'

async function processVideoUploadTmpFolderCleaner () {
  const tmpPath = await getTmpPath()
  let files: string[]

  logger.debug('processVideoUploadTmpFolderCleaner: Reading files from path %s', tmpPath)

  try {
    files = await readdir(tmpPath)
  } catch (error) {
    logger.error('Failed to read resumable video upload tmp folder.', { error })
    return
  }

  logger.debug('processVideoUploadTmpFolderCleaner: Found %d files', files.length)

  await Promise.all(files.map(async function (file) {
    const filePath = path.join(tmpPath, file)
    let statResult: Stats

    try {
      statResult = await stat(filePath)
    } catch (error) {
      logger.error(`Failed to run stat for ${filePath}`, { error })
      return
    }

    // current time (in miliseconds):
    const now = new Date().getTime()
    // time of last status change, plus 1h (in miliseconds):
    const endTime = new Date(statResult.ctime).getTime() + SCHEDULER_INTERVALS_MS.removeTmpVideo

    if (now > endTime) {
      try {
        await unlink(filePath)
      } catch (error) {
        logger.error(`Failed to unlink ${filePath}`, { error })
      }
    }
  }))
}

// ---------------------------------------------------------------------------

export {
  processVideoUploadTmpFolderCleaner
}
