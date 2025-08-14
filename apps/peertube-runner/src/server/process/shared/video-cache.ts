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

type ResourceType = 'video' | 'audio'

function extractFromInputUrl (url: string): { videoUUID: string, resource: ResourceType } | undefined {
  // Matches:
  //  - /api/v1/runners/jobs/:jobUUID/files/videos/:videoUUID/max-quality
  //  - /api/v1/runners/jobs/:jobUUID/files/videos/:videoUUID/max-quality/audio
  const audio = url.match(/\/api\/v1\/runners\/jobs\/[^/]+\/files\/videos\/([^/]+)\/max-quality\/audio(\/|$)/)
  if (audio?.[1]) return { videoUUID: audio[1], resource: 'audio' }

  const video = url.match(/\/api\/v1\/runners\/jobs\/[^/]+\/files\/videos\/([^/]+)\/max-quality(\/|$)/)
  if (video?.[1]) return { videoUUID: video[1], resource: 'video' }

  return undefined
}

function getCacheKey (videoUUID: string, resource: ResourceType) {
  return `${videoUUID}:${resource}`
}

export class VideoInputCacheManager {
  private static instance: VideoInputCacheManager

  private readonly resourceKeyToEntry = new Map<string, CacheEntry>()

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async acquire (options: AcquireOptions) {
    const { url, job, runnerToken, server } = options

    const extracted = extractFromInputUrl(url)
    if (!extracted) {
      logger.warn(`Could not extract video UUID/resource from input url ${url} - falling back to direct download for job ${job.jobToken}`)
      const { downloadInputFile } = await import('./common.js')
      const path = await downloadInputFile({ url, job, runnerToken })

      return {
        resourceKey: undefined as string | undefined,
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

    const { videoUUID, resource } = extracted
    const resourceKey = getCacheKey(videoUUID, resource)
    const cached = this.resourceKeyToEntry.get(resourceKey)
    if (cached) {
      // Wait a potential ongoing download, then increment refs
      if (cached.downloading) await cached.downloading

      const exists = await pathExists(cached.filePath)
      if (exists) {
        cached.refCount += 1
        logger.info(`Using cached ${resource} input for video ${videoUUID} (refs=${cached.refCount}) for job ${job.jobToken}`)

        return {
          resourceKey,
          path: cached.filePath,
          release: () => this.release({ resourceKey, server })
        }
      }

      // File was removed; drop cache entry
      this.resourceKeyToEntry.delete(resourceKey)
      logger.warn(`Cached ${resource} input for video ${videoUUID} missing on disk. Re-downloading for job ${job.jobToken}`)
    }

    // Download and cache
    const destination = join(ConfigManager.Instance.getTranscodingDirectory(), `cached-input-${videoUUID}-${resource}`)

    await ensureDir(ConfigManager.Instance.getTranscodingDirectory())

    const { downloadFile } = await import('../../../shared/http.js')

    const downloading = downloadFile({ url, jobToken: job.jobToken, runnerToken, destination })
      .then(() => destination)

    this.resourceKeyToEntry.set(resourceKey, { filePath: destination, refCount: 1, downloading })

    logger.info(`Downloading and caching ${resource} input for video ${videoUUID} to ${destination} for job ${job.jobToken}`)

    try {
      await downloading
    } catch (err) {
      // Cleanup on error
      this.resourceKeyToEntry.delete(resourceKey)
      try {
        await remove(destination)
      } catch (err2) {
        logger.error({ err: err2 }, `Cannot remove failed cached input ${destination}`)
      }

      throw err
    }

    // Download finished
    const entry = this.resourceKeyToEntry.get(resourceKey)
    if (entry) delete entry.downloading

    return {
      resourceKey,
      path: destination,
      release: () => this.release({ resourceKey, server })
    }
  }

  async release (options: { resourceKey: string, server: AcquireOptions['server'] }) {
    const { resourceKey, server } = options
    const entry = this.resourceKeyToEntry.get(resourceKey)
    if (!entry) return

    entry.refCount -= 1
    logger.debug(`Released cached input ${resourceKey} (refs=${entry.refCount})`)

    if (entry.refCount > 0) return

    // Check if server still has pending jobs for this video
    try {
      const { availableJobs } = await server.runnerJobs.request({ runnerToken: (server as any).runnerToken })

      const [ videoUUID, resource ] = resourceKey.split(':') as [ string, ResourceType ]
      const hasPendingForVideo = availableJobs.some(j => {
        const p: any = (j as any).payload
        if (!p?.input) return false

        if (resource === 'video') {
          const url = p.input.videoFileUrl as string | undefined
          if (!url) return false
          const extracted = extractFromInputUrl(url)
          return extracted?.videoUUID === videoUUID && extracted.resource === 'video'
        } else {
          const urls: string[] | undefined = p.input.separatedAudioFileUrl
          if (!urls || urls.length === 0) return false
          const extracted = extractFromInputUrl(urls[0])
          return extracted?.videoUUID === videoUUID && extracted.resource === 'audio'
        }
      })

      if (hasPendingForVideo) {
        logger.info(`Keeping cached input ${resourceKey} because there are still pending jobs for it`)
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
      logger.warn({ err }, `Cannot check pending jobs on server. Keeping cached input ${resourceKey}`)
      return
    }

    // Safe to remove this cache
    await this.removeEntry(resourceKey)
  }

  private async removeEntry (resourceKey: string) {
    const entry = this.resourceKeyToEntry.get(resourceKey)
    if (!entry) return

    this.resourceKeyToEntry.delete(resourceKey)

    try {
      await remove(entry.filePath)
      logger.info(`Removed cached input ${resourceKey} at ${entry.filePath}`)
    } catch (err) {
      logger.error({ err }, `Cannot remove cached input file ${entry.filePath} for ${resourceKey}`)
    }
  }

  async purgeUnused () {
    const removals: Promise<void>[] = []
    for (const [ resourceKey, entry ] of this.resourceKeyToEntry) {
      if (entry.refCount === 0) removals.push(this.removeEntry(resourceKey))
    }
    await Promise.all(removals)
  }
}

export async function acquireCachedVideoInputFile (options: AcquireOptions) {
  return VideoInputCacheManager.Instance.acquire(options)
}

export async function acquireCachedInputFile (options: AcquireOptions) {
  return VideoInputCacheManager.Instance.acquire(options)
}

export async function acquireCachedSeparatedAudioInputFile (options: AcquireOptions) {
  return VideoInputCacheManager.Instance.acquire(options)
}


