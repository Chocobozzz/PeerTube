import { writeJson } from 'fs-extra'
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
  private readonly streamingPlaylist: MStreamingPlaylistVideo
  private readonly sendToObjectStorage: boolean

  constructor (options: {
    videoUUID: string
    sha256Path: string
    streamingPlaylist: MStreamingPlaylistVideo
    sendToObjectStorage: boolean
  }) {
    this.videoUUID = options.videoUUID
    this.sha256Path = options.sha256Path
    this.streamingPlaylist = options.streamingPlaylist
    this.sendToObjectStorage = options.sendToObjectStorage
  }

  async addSegmentSha (segmentPath: string) {
    logger.debug('Adding live sha segment %s.', segmentPath, lTags(this.videoUUID))

    const shaResult = await buildSha256Segment(segmentPath)

    const segmentName = basename(segmentPath)
    this.segmentsSha256.set(segmentName, shaResult)

    await this.writeToDisk()
  }

  async removeSegmentSha (segmentPath: string) {
    const segmentName = basename(segmentPath)

    logger.debug('Removing live sha segment %s.', segmentPath, lTags(this.videoUUID))

    if (!this.segmentsSha256.has(segmentName)) {
      logger.warn('Unknown segment in files map for video %s and segment %s.', this.videoUUID, segmentPath, lTags(this.videoUUID))
      return
    }

    this.segmentsSha256.delete(segmentName)

    await this.writeToDisk()
  }

  private async writeToDisk () {
    await writeJson(this.sha256Path, mapToJSON(this.segmentsSha256))

    if (this.sendToObjectStorage) {
      const url = await storeHLSFileFromPath(this.streamingPlaylist, this.sha256Path)

      if (this.streamingPlaylist.segmentsSha256Url !== url) {
        this.streamingPlaylist.segmentsSha256Url = url
        await this.streamingPlaylist.save()
      }
    }
  }

}

export {
  LiveSegmentShaStore
}
