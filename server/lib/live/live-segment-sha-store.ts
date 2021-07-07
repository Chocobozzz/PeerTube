import { basename } from 'path'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { buildSha256Segment } from '../hls'

const lTags = loggerTagsFactory('live')

class LiveSegmentShaStore {

  private static instance: LiveSegmentShaStore

  private readonly segmentsSha256 = new Map<string, Map<string, string>>()

  private constructor () {
  }

  getSegmentsSha256 (videoUUID: string) {
    return this.segmentsSha256.get(videoUUID)
  }

  async addSegmentSha (videoUUID: string, segmentPath: string) {
    const segmentName = basename(segmentPath)
    logger.debug('Adding live sha segment %s.', segmentPath, lTags(videoUUID))

    const shaResult = await buildSha256Segment(segmentPath)

    if (!this.segmentsSha256.has(videoUUID)) {
      this.segmentsSha256.set(videoUUID, new Map())
    }

    const filesMap = this.segmentsSha256.get(videoUUID)
    filesMap.set(segmentName, shaResult)
  }

  removeSegmentSha (videoUUID: string, segmentPath: string) {
    const segmentName = basename(segmentPath)

    logger.debug('Removing live sha segment %s.', segmentPath, lTags(videoUUID))

    const filesMap = this.segmentsSha256.get(videoUUID)
    if (!filesMap) {
      logger.warn('Unknown files map to remove sha for %s.', videoUUID, lTags(videoUUID))
      return
    }

    if (!filesMap.has(segmentName)) {
      logger.warn('Unknown segment in files map for video %s and segment %s.', videoUUID, segmentPath, lTags(videoUUID))
      return
    }

    filesMap.delete(segmentName)
  }

  cleanupShaSegments (videoUUID: string) {
    this.segmentsSha256.delete(videoUUID)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  LiveSegmentShaStore
}
