import { HttpStatusCode, LiveVideo, VideoDetails } from '../../../../../shared/models'
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
      console.error(err)

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

  loadVideoWithLive (video: VideoDetails) {
    return this.http.fetch(this.getLiveUrl(video.uuid), { optionalAuth: true })
      .then(res => res.json())
      .then((live: LiveVideo) => ({ video, live }))
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
}
