import { HttpStatusCode, LiveVideo, VideoDetails, VideoToken } from '../../../../../shared/models'
import { logger } from '../../../root-helpers'
import { AuthHTTP } from './auth-http'

export class VideoFetcher {

  constructor (private readonly http: AuthHTTP) {

  }

  async loadVideo (videoId: string) {
    const videoPromise = this.loadVideoInfo(videoId)

    let videoResponse: Response
    let isResponseOk: boolean

    try {
      videoResponse = await videoPromise
      isResponseOk = videoResponse.status === HttpStatusCode.OK_200
    } catch (err) {
      logger.error(err)

      isResponseOk = false
    }

    if (!isResponseOk) {
      if (videoResponse?.status === HttpStatusCode.NOT_FOUND_404) {
        throw new Error('This video does not exist.')
      }

      throw new Error('We cannot fetch the video. Please try again later.')
    }

    const captionsPromise = this.loadVideoCaptions(videoId)

    return { captionsPromise, videoResponse }
  }

  loadLive (video: VideoDetails) {
    return this.http.fetch(this.getLiveUrl(video.uuid), { optionalAuth: true })
      .then(res => res.json() as Promise<LiveVideo>)
  }

  loadVideoToken (video: VideoDetails) {
    return this.http.fetch(this.getVideoTokenUrl(video.uuid), { optionalAuth: true, method: 'POST' })
      .then(res => res.json() as Promise<VideoToken>)
      .then(token => token.files.token)
  }

  getVideoViewsUrl (videoUUID: string) {
    return this.getVideoUrl(videoUUID) + '/views'
  }

  private loadVideoInfo (videoId: string): Promise<Response> {
    return this.http.fetch(this.getVideoUrl(videoId), { optionalAuth: true })
  }

  private loadVideoCaptions (videoId: string): Promise<Response> {
    return this.http.fetch(this.getVideoUrl(videoId) + '/captions', { optionalAuth: true })
  }

  private getVideoUrl (id: string) {
    return window.location.origin + '/api/v1/videos/' + id
  }

  private getLiveUrl (videoId: string) {
    return window.location.origin + '/api/v1/videos/live/' + videoId
  }

  private getVideoTokenUrl (id: string) {
    return this.getVideoUrl(id) + '/token'
  }
}
