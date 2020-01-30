import { join } from 'path'
import { FILES_CACHE } from '../../initializers/constants'
import { VideoModel } from '../../models/video/video'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'
import { CONFIG } from '../../initializers/config'
import { logger } from '../../helpers/logger'
import { doRequestAndSaveToFile } from '@server/helpers/requests'

type GetPathParam = { videoId: string, language: string }

class VideosCaptionCache extends AbstractVideoStaticFileCache <GetPathParam> {

  private static readonly KEY_DELIMITER = '%'
  private static instance: VideosCaptionCache

  private constructor () {
    super()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  async getFilePathImpl (params: GetPathParam) {
    const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(params.videoId, params.language)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) return { isOwned: true, path: join(CONFIG.STORAGE.CAPTIONS_DIR, videoCaption.getCaptionName()) }

    const key = params.videoId + VideosCaptionCache.KEY_DELIMITER + params.language
    return this.loadRemoteFile(key)
  }

  protected async loadRemoteFile (key: string) {
    logger.debug('Loading remote caption file %s.', key)

    const [ videoId, language ] = key.split(VideosCaptionCache.KEY_DELIMITER)

    const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(videoId, language)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) throw new Error('Cannot load remote caption of owned video.')

    // Used to fetch the path
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
    if (!video) return undefined

    const remoteUrl = videoCaption.getFileUrl(video)
    const destPath = join(FILES_CACHE.VIDEO_CAPTIONS.DIRECTORY, videoCaption.getCaptionName())

    await doRequestAndSaveToFile({ uri: remoteUrl }, destPath)

    return { isOwned: false, path: destPath }
  }
}

export {
  VideosCaptionCache
}
