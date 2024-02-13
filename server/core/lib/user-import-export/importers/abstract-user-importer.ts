import { getFileSize } from '@peertube/peertube-node-utils'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { MUserDefault } from '@server/types/models/user/user.js'
import { pathExists, readJSON, remove } from 'fs-extra/esm'
import { dirname, resolve } from 'path'

const lTags = loggerTagsFactory('user-import')

export abstract class AbstractUserImporter <
  ROOT_OBJECT,
  OBJECT extends { archiveFiles?: Record<string, string | Record<string, string>> },
  SANITIZED_OBJECT
> {
  protected user: MUserDefault
  protected extractedDirectory: string
  protected jsonFilePath: string

  constructor (options: {
    user: MUserDefault

    extractedDirectory: string

    jsonFilePath: string
  }) {
    this.user = options.user
    this.extractedDirectory = options.extractedDirectory
    this.jsonFilePath = options.jsonFilePath
  }

  getJSONFilePath () {
    return this.jsonFilePath
  }

  protected getSafeArchivePathOrThrow (path: string) {
    if (!path) return undefined

    const resolved = resolve(dirname(this.jsonFilePath), path)
    if (resolved.startsWith(this.extractedDirectory) !== true) {
      throw new Error(`Static file path ${resolved} is outside the archive directory ${this.extractedDirectory}`)
    }

    return resolved
  }

  protected async cleanupImportedStaticFilePaths (archiveFiles: Record<string, string | Record<string, string>>) {
    if (!archiveFiles || typeof archiveFiles !== 'object') return

    for (const file of Object.values(archiveFiles)) {
      if (!file) continue

      try {
        if (typeof file === 'string') {
          await remove(this.getSafeArchivePathOrThrow(file))
        } else { // Avoid recursion to prevent security issue
          for (const subFile of Object.values(file)) {
            await remove(this.getSafeArchivePathOrThrow(subFile))
          }
        }
      } catch (err) {
        logger.error(`Cannot remove file ${file} after successful import`, { err, ...lTags() })
      }
    }
  }

  protected async isFileValidOrLog (filePath: string, maxSize: number) {
    if (!await pathExists(filePath)) {
      logger.warn(`Do not import file ${filePath} that do not exist in zip`, lTags())
      return false
    }

    const size = await getFileSize(filePath)
    if (size > maxSize) {
      logger.warn(
        `Do not import too big file ${filePath} (${size} > ${maxSize})`,
        lTags()
      )
      return false
    }

    return true
  }

  async import () {
    const importData: ROOT_OBJECT = await readJSON(this.jsonFilePath)
    const summary = {
      duplicates: 0,
      success: 0,
      errors: 0
    }

    for (const importObject of this.getImportObjects(importData)) {
      try {
        const sanitized = this.sanitize(importObject)

        if (!sanitized) {
          logger.warn('Do not import object after invalid sanitization', { importObject, ...lTags() })
          summary.errors++
          continue
        }

        const result = await this.importObject(sanitized)

        await this.cleanupImportedStaticFilePaths(importObject.archiveFiles)

        if (result.duplicate === true) summary.duplicates++
        else summary.success++
      } catch (err) {
        logger.error('Cannot import object from ' + this.jsonFilePath, { err, importObject, ...lTags() })

        summary.errors++
      }
    }

    return summary
  }

  protected abstract getImportObjects (object: ROOT_OBJECT): OBJECT[]

  protected abstract sanitize (object: OBJECT): SANITIZED_OBJECT | undefined

  protected abstract importObject (object: SANITIZED_OBJECT): Awaitable<{ duplicate: boolean }>
}
