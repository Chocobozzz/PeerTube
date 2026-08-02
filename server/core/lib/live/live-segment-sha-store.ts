import { buildSUUID } from '@peertube/peertube-node-utils'
import { mapToJSON } from '@server/helpers/core-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { LRU_CACHE } from '@server/initializers/constants.js'
import { MStreamingPlaylistVideo } from '@server/types/models/index.js'
import { writeJson } from 'fs-extra/esm'
import { rename } from 'fs/promises'
import { LRUCache } from 'lru-cache'
import { basename, dirname, join } from 'path'
import { buildSha256Segment } from '../hls.js'
import { storeHLSFileFromPath } from '../object-storage/index.js'

const lTags = loggerTagsFactory('live')

class LiveSegmentShaStore {
  private readonly segmentsSha256 = new Map<string, string>()

  private readonly removedSegments = new LRUCache<string, true>({ max: LRU_CACHE.LIVE_SEGMENT_SHA_REMOVED_SEGMENTS.MAX_SIZE })

  private readonly videoUUID: string

  private readonly sha256Path: string
  private readonly sha256PathTMP: string

  private readonly streamingPlaylist: MStreamingPlaylistVideo
  private readonly sendToObjectStorage: boolean

  // Coalesce concurrent writeToDisk() calls into a single write of the latest map state
  // instead of queueing/running one full write per add/remove call
  private writeLoopPromise: Promise<void> | null = null
  private dirty = false

  constructor (options: {
    videoUUID: string
    sha256Path: string
    streamingPlaylist: MStreamingPlaylistVideo
    sendToObjectStorage: boolean
  }) {
    this.videoUUID = options.videoUUID

    this.sha256Path = options.sha256Path
    this.sha256PathTMP = join(dirname(options.sha256Path), buildSUUID() + '-segments-sha256.json.tmp')

    this.streamingPlaylist = options.streamingPlaylist
    this.sendToObjectStorage = options.sendToObjectStorage
  }

  async addSegmentSha (segmentPath: string) {
    const segmentName = basename(segmentPath)

    // This segment has already been removed (its "unlink" event ran before we finished hashing it)
    if (this.removedSegments.delete(segmentName)) {
      logger.debug('Segment %s was removed before its hash could be added, ignoring it.', segmentPath, lTags(this.videoUUID))
      return
    }

    logger.debug('Adding live sha segment %s.', segmentPath, lTags(this.videoUUID))

    const shaResult = await buildSha256Segment(segmentPath)

    this.segmentsSha256.set(segmentName, shaResult)

    await this.writeToDisk()
  }

  removeSegmentSha (segmentPath: string) {
    const segmentName = basename(segmentPath)

    logger.debug('Removing live sha segment %s.', segmentPath, lTags(this.videoUUID))

    if (!this.segmentsSha256.has(segmentName)) {
      logger.debug(
        'Unknown segment in live segment hash store for video %s and segment %s.',
        this.videoUUID,
        segmentPath,
        lTags(this.videoUUID)
      )

      // Its hash may still be pending (addSegmentSha hasn't run yet)
      // Remember it so we discard the hash instead of leaking it
      this.removedSegments.set(segmentName, true)
      return
    }

    this.segmentsSha256.delete(segmentName)

    // Don't write to disk: the next addSegmentSha() call will persist this removal
  }

  private writeToDisk () {
    this.dirty = true

    if (this.writeLoopPromise === null) {
      this.writeLoopPromise = this.runWriteLoop()
    }

    return this.writeLoopPromise
  }

  private async runWriteLoop () {
    while (this.dirty) {
      this.dirty = false

      try {
        await this.writeOnce()
      } catch (err) {
        logger.error('Cannot write sha segments to disk.', { err })
      }
    }

    this.writeLoopPromise = null
  }

  private async writeOnce () {
    logger.debug(`Writing segment sha JSON ${this.sha256Path} of ${this.videoUUID} on disk.`, lTags(this.videoUUID))

    // Atomic write: use rename instead of move that is not atomic
    // FIXME: jsonfile typings
    await (writeJson(this.sha256PathTMP, mapToJSON(this.segmentsSha256), { flush: true } as any) as unknown as Promise<void>)
    await rename(this.sha256PathTMP, this.sha256Path)

    if (this.sendToObjectStorage) {
      await storeHLSFileFromPath(this.streamingPlaylist.Video, this.sha256Path)
    }
  }
}

export {
  LiveSegmentShaStore
}
