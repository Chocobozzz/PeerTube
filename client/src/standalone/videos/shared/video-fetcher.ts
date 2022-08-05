import { HttpStatusCode, LiveVideo, VideoDetails } from '../../../../../shared/models'
import { logger } from '../../../root-helpers'
import { AuthHTTP } from './auth-http'
declare global {
	interface Window { peertubeglobalcache: Object; }
}
export class VideoFetcher {

  constructor (private readonly http: AuthHTTP) {

  }

  async loadVideo (videoId: string, host: string) {
    const videoPromise = this.loadVideoInfo(videoId, host)

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

    //const captionsPromise = this.loadVideoCaptions(videoId)

    return { videoResponse }
  }

  async loadVideoCache (videoId: string, host: string) {

    if (!window.peertubeglobalcache) window.peertubeglobalcache = {}

		if (window.peertubeglobalcache[videoId]) {

			if (window.peertubeglobalcache[videoId].state && window.peertubeglobalcache[videoId].state.id != 2) {
				return Promise.resolve({videoDetails : window.peertubeglobalcache[videoId]})
			}
		}

    return this.loadVideo(videoId, host).then(({ videoResponse }) => {
			return videoResponse.json()
		}).then((json) => {

			if (json && Object.keys(json).length != 0) {
				window.peertubeglobalcache[videoId] = json
			}

			return json
		})
  }

  loadVideoWithLive (video: VideoDetails, host: string) {
    return this.http.fetch(this.getLiveUrl(video.uuid, host), { optionalAuth: true })
      .then(res => res.json())
      .then((live: LiveVideo) => ({ video, live }))
  }

  getVideoViewsUrl (videoUUID: string, host: string) {
    return this.getVideoUrl(videoUUID, host) + '/views'
  }

  private loadVideoInfo (videoId: string, host: string): Promise<Response> {
    return this.http.fetch(this.getVideoUrl(videoId, host), { optionalAuth: true })
  }

  private loadVideoCaptions (videoId: string, host: string): Promise<Response> {
    return this.http.fetch(this.getVideoUrl(videoId, host) + '/captions', { optionalAuth: true })
  }

  private getVideoUrl (id: string, host: string) {
    return host + '/api/v1/videos/' + id
  }

  private getLiveUrl (videoId: string, host: string) {
    return host + '/api/v1/videos/live/' + videoId
  }
}
