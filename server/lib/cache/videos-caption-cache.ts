import { join } from 'path'
import { CACHE, CONFIG } from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { AbstractVideoStaticFileCache } from './abstract-video-static-file-cache'

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

  async getFilePath (params: GetPathParam) {
    const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(params.videoId, params.language)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) return join(CONFIG.STORAGE.CAPTIONS_DIR, videoCaption.getCaptionName())

    const key = params.videoId + VideosCaptionCache.KEY_DELIMITER + params.language
    return this.loadFromLRU(key)
  }

  protected async loadRemoteFile (key: string) {
    const [ videoId, language ] = key.split(VideosCaptionCache.KEY_DELIMITER)

    const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(videoId, language)
    if (!videoCaption) return undefined

    if (videoCaption.isOwned()) throw new Error('Cannot load remote caption of owned video.')

    // Used to fetch the path
    const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(videoId)
    if (!video) return undefined

    const remoteStaticPath = videoCaption.getCaptionStaticPath()
    const destPath = join(CACHE.VIDEO_CAPTIONS.DIRECTORY, videoCaption.getCaptionName())

    return this.saveRemoteVideoFileAndReturnPath(video, remoteStaticPath, destPath)
  }
}

export {
  VideosCaptionCache
}
