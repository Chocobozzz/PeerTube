import { VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { getFileSize } from '@peertube/peertube-node-utils'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { getOrCreateAPVideo } from '@server/lib/activitypub/videos/get.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoImmutable } from '@server/types/models/index.js'
import { MUserDefault } from '@server/types/models/user/user.js'
import { pathExists, readJSON, remove } from 'fs-extra/esm'
import { dirname, resolve, sep } from 'path'

const logger = createLogger()

export abstract class AbstractUserImporter<
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
    if (resolved.startsWith(this.extractedDirectory + sep) !== true) {
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
        logger.error(`Cannot remove file ${file} after successful import`, { err })
      }
    }
  }

  protected async isFileValidOrLog (filePath: string, maxSize: number) {
    if (!await pathExists(filePath)) {
      logger.warn(`Do not import file ${filePath} that do not exist in zip`)
      return false
    }

    const size = await getFileSize(filePath)
    if (size > maxSize) {
      logger.warn(
        `Do not import too big file ${filePath} (${size} > ${maxSize})`
      )
      return false
    }

    return true
  }

  // Load a video referenced by the archive (rates, playlists, history...)
  // The archive can contain any URL: only return videos the user is allowed to see
  protected async loadOrCreateVideoIfAllowed (videoUrl: string): Promise<MVideoImmutable> {
    const video = await this.loadOrCreateVideoWithRights(videoUrl)
    if (!video) return undefined

    // Owners can see their videos, whatever their privacy or blacklist state
    if (video.VideoChannel?.Account?.id === this.user.Account.id) return video

    if (video.isBlacklisted()) return undefined

    const allowedPrivacies = new Set<VideoPrivacyType>([ VideoPrivacy.PUBLIC, VideoPrivacy.UNLISTED, VideoPrivacy.INTERNAL ])
    if (!allowedPrivacies.has(video.privacy)) return undefined

    return video
  }

  private async loadOrCreateVideoWithRights (videoUrl: string) {
    // Most videos of the archive are already known: load them and their rights with a single query
    const video = await VideoModel.loadByUrlWithRights(videoUrl)
    if (video || !CONFIG.SEARCH.REMOTE_URI.USERS) return video

    try {
      const res = await getOrCreateAPVideo({
        videoObject: videoUrl,
        fetchType: 'unsafe-immutable-only',
        allowRefresh: false
      })
      if (!res?.video) return undefined

      return VideoModel.loadWithRights(res.video.id)
    } catch {
      return undefined
    }
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
          logger.warn('Do not import object after invalid sanitization', { importObject })
          summary.errors++
          continue
        }

        const result = await this.importObject(sanitized)

        await this.cleanupImportedStaticFilePaths(importObject.archiveFiles)

        if (result.duplicate === true) summary.duplicates++
        else summary.success++
      } catch (err) {
        logger.error('Cannot import object from ' + this.jsonFilePath, { err, importObject })

        summary.errors++
      }
    }

    return summary
  }

  protected abstract getImportObjects (object: ROOT_OBJECT): OBJECT[]

  protected abstract sanitize (object: OBJECT): SANITIZED_OBJECT | undefined

  protected abstract importObject (object: SANITIZED_OBJECT): Awaitable<{ duplicate: boolean }>
}
