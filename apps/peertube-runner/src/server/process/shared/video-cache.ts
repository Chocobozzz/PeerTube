import { ensureDir, pathExists, remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager, logger } from '../../../shared/index.js'
import { JobWithToken, ProcessOptions } from './common.js'

type AcquireOptions = {
  url: string
  job: JobWithToken
  runnerToken: string
  server: ProcessOptions['server']
}

type CacheEntry = {
  filePath: string
  refCount: number
  downloading?: Promise<string>
}

function extractVideoUUIDFromInputUrl (url: string) {
  // /api/v1/runners/jobs/:jobUUID/files/videos/:videoUUID/max-quality
  const match = url.match(/\/api\/v1\/runners\/jobs\/[^/]+\/files\/videos\/([^/]+)\/max-quality(\/|$)/)
  return match?.[1]
}

export class VideoInputCacheManager {
  private static instance: VideoInputCacheManager

  private readonly videoUUIDToEntry = new Map<string, CacheEntry>()

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async acquire (options: AcquireOptions) {
    const { url, job, runnerToken, server } = options

    const videoUUID = extractVideoUUIDFromInputUrl(url)
    if (!videoUUID) {
      logger.warn(`Could not extract video UUID from input url ${url} - falling back to direct download for job ${job.jobToken}`)
      const { downloadInputFile } = await import('./common.js')
      const path = await downloadInputFile({ url, job, runnerToken })

      return {
        videoUUID: undefined as string | undefined,
        path,
        release: async () => {
          try {
            await remove(path)
          } catch (err) {
            logger.error({ err }, `Cannot remove temporary downloaded input ${path}`)
          }
        }
      }
    }

    const cached = this.videoUUIDToEntry.get(videoUUID)
    if (cached) {
      // Wait a potential ongoing download, then increment refs
      if (cached.downloading) await cached.downloading

      const exists = await pathExists(cached.filePath)
      if (exists) {
        cached.refCount += 1
        logger.info(`Using cached max-quality input for video ${videoUUID} (refs=${cached.refCount}) for job ${job.jobToken}`)

        return {
          videoUUID,
          path: cached.filePath,
          release: () => this.release({ videoUUID, server })
        }
      }

      // File was removed; drop cache entry
      this.videoUUIDToEntry.delete(videoUUID)
      logger.warn(`Cached input for video ${videoUUID} missing on disk. Re-downloading for job ${job.jobToken}`)
    }

    // Download and cache
    const destination = join(ConfigManager.Instance.getTranscodingDirectory(), `cached-input-${videoUUID}`)

    await ensureDir(ConfigManager.Instance.getTranscodingDirectory())

    const { downloadFile } = await import('../../../shared/http.js')

    const downloading = downloadFile({ url, jobToken: job.jobToken, runnerToken, destination })
      .then(() => destination)

    this.videoUUIDToEntry.set(videoUUID, { filePath: destination, refCount: 1, downloading })

    logger.info(`Downloading and caching max-quality input for video ${videoUUID} to ${destination} for job ${job.jobToken}`)

    try {
      await downloading
    } catch (err) {
      // Cleanup on error
      this.videoUUIDToEntry.delete(videoUUID)
      try {
        await remove(destination)
      } catch (err2) {
        logger.error({ err: err2 }, `Cannot remove failed cached input ${destination}`)
      }

      throw err
    }

    // Download finished
    const entry = this.videoUUIDToEntry.get(videoUUID)
    if (entry) delete entry.downloading

    return {
      videoUUID,
      path: destination,
      release: () => this.release({ videoUUID, server })
    }
  }

  async release (options: { videoUUID: string, server: AcquireOptions['server'] }) {
    const { videoUUID, server } = options
    const entry = this.videoUUIDToEntry.get(videoUUID)
    if (!entry) return

    entry.refCount -= 1
    logger.debug(`Released cached input for video ${videoUUID} (refs=${entry.refCount})`)

    if (entry.refCount > 0) return

    // Check if server still has pending jobs for this video
    try {
      const { availableJobs } = await server.runnerJobs.request({ runnerToken: (server as any).runnerToken })

      const hasPendingForVideo = availableJobs.some(j => {
        // The availableJobs contain payload with input.videoFileUrl
        const url = (j as any).payload?.input?.videoFileUrl as string | undefined
        if (!url) return false
        const u = extractVideoUUIDFromInputUrl(url)
        return u === videoUUID
      })

      if (hasPendingForVideo) {
        logger.info(`Keeping cached input for video ${videoUUID} because there are still pending jobs for it`)
        return
      }

      // If no jobs at all, purge all caches with zero refs
      if (availableJobs.length === 0) {
        logger.info('No pending jobs on server. Purging all cached inputs with zero references')
        await this.purgeUnused()
        return
      }
    } catch (err) {
      // On error, be conservative and keep the cache
      logger.warn({ err }, `Cannot check pending jobs on server. Keeping cached input for video ${videoUUID}`)
      return
    }

    // Safe to remove this cache
    await this.removeEntry(videoUUID)
  }

  private async removeEntry (videoUUID: string) {
    const entry = this.videoUUIDToEntry.get(videoUUID)
    if (!entry) return

    this.videoUUIDToEntry.delete(videoUUID)

    try {
      await remove(entry.filePath)
      logger.info(`Removed cached input for video ${videoUUID} at ${entry.filePath}`)
    } catch (err) {
      logger.error({ err }, `Cannot remove cached input file ${entry.filePath} for video ${videoUUID}`)
    }
  }

  async purgeUnused () {
    const removals: Promise<void>[] = []
    for (const [ videoUUID, entry ] of this.videoUUIDToEntry) {
      if (entry.refCount === 0) removals.push(this.removeEntry(videoUUID))
    }
    await Promise.all(removals)
  }
}

export async function acquireCachedVideoInputFile (options: AcquireOptions) {
  return VideoInputCacheManager.Instance.acquire(options)
}


