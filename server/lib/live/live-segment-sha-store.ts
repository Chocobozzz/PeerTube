import { rename, writeJson } from 'fs-extra'
import PQueue from 'p-queue'
import { basename } from 'path'
import { mapToJSON } from '@server/helpers/core-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { MStreamingPlaylistVideo } from '@server/types/models'
import { buildSha256Segment } from '../hls'
import { storeHLSFileFromPath } from '../object-storage'

const lTags = loggerTagsFactory('live')

class LiveSegmentShaStore {

  private readonly segmentsSha256 = new Map<string, string>()

  private readonly videoUUID: string

  private readonly sha256Path: string
  private readonly sha256PathTMP: string

  private readonly streamingPlaylist: MStreamingPlaylistVideo
  private readonly sendToObjectStorage: boolean
  private readonly writeQueue = new PQueue({ concurrency: 1 })

  constructor (options: {
    videoUUID: string
    sha256Path: string
    streamingPlaylist: MStreamingPlaylistVideo
    sendToObjectStorage: boolean
  }) {
    this.videoUUID = options.videoUUID

    this.sha256Path = options.sha256Path
    this.sha256PathTMP = options.sha256Path + '.tmp'

    this.streamingPlaylist = options.streamingPlaylist
    this.sendToObjectStorage = options.sendToObjectStorage
  }

  async addSegmentSha (segmentPath: string) {
    logger.debug('Adding live sha segment %s.', segmentPath, lTags(this.videoUUID))

    const shaResult = await buildSha256Segment(segmentPath)

    const segmentName = basename(segmentPath)
    this.segmentsSha256.set(segmentName, shaResult)

    try {
      await this.writeToDisk()
    } catch (err) {
      logger.error('Cannot write sha segments to disk.', { err })
    }
  }

  async removeSegmentSha (segmentPath: string) {
    const segmentName = basename(segmentPath)

    logger.debug('Removing live sha segment %s.', segmentPath, lTags(this.videoUUID))

    if (!this.segmentsSha256.has(segmentName)) {
      logger.warn(
        'Unknown segment in live segment hash store for video %s and segment %s.',
        this.videoUUID, segmentPath, lTags(this.videoUUID)
      )
      return
    }

    this.segmentsSha256.delete(segmentName)

    await this.writeToDisk()
  }

  private writeToDisk () {
    return this.writeQueue.add(async () => {
      // Atomic write: use rename instead of move that is not atomic
      await writeJson(this.sha256PathTMP, mapToJSON(this.segmentsSha256))
      await rename(this.sha256PathTMP, this.sha256Path)

      if (this.sendToObjectStorage) {
        const url = await storeHLSFileFromPath(this.streamingPlaylist, this.sha256Path)

        if (this.streamingPlaylist.segmentsSha256Url !== url) {
          this.streamingPlaylist.segmentsSha256Url = url
          await this.streamingPlaylist.save()
        }
      }
    })
  }
}

export {
  LiveSegmentShaStore
}
