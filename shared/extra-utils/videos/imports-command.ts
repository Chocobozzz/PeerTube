
import { ResultList } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { VideoImport, VideoImportCreate } from '../../models/videos'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class ImportsCommand extends AbstractCommand {

  static getYoutubeVideoUrl () {
    return 'https://www.youtube.com/watch?v=msX3jv1XdvM'
  }

  static getYoutubeHDRVideoUrl () {
    /**
     * The video is used to check format-selection correctness wrt. HDR,
     * which brings its own set of oddities outside of a MediaSource.
     * FIXME: refactor once HDR is supported at playback
     *
     * The video needs to have the following format_ids:
     * (which you can check by using `youtube-dl <url> -F`):
     * - 303 (1080p webm vp9)
     * - 299 (1080p mp4 avc1)
     * - 335 (1080p webm vp9.2 HDR)
     *
     * 15 jan. 2021: TEST VIDEO NOT CURRENTLY PROVIDING
     * - 400 (1080p mp4 av01)
     * - 315 (2160p webm vp9 HDR)
     * - 337 (2160p webm vp9.2 HDR)
     * - 401 (2160p mp4 av01 HDR)
     */
    return 'https://www.youtube.com/watch?v=qR5vOXbZsI4'
  }

  static getMagnetURI () {
    // eslint-disable-next-line max-len
    return 'magnet:?xs=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Ftorrents%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.torrent&xt=urn:btih:0f498834733e8057ed5c6f2ee2b4efd8d84a76ee&dn=super+peertube2+video&tr=wss%3A%2F%2Fpeertube2.cpy.re%3A443%2Ftracker%2Fsocket&tr=https%3A%2F%2Fpeertube2.cpy.re%2Ftracker%2Fannounce&ws=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Fwebseed%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.mp4'
  }

  static getBadVideoUrl () {
    return 'https://download.cpy.re/peertube/bad_video.mp4'
  }

  static getGoodVideoUrl () {
    return 'https://download.cpy.re/peertube/good_video.mp4'
  }

  importVideo (options: OverrideCommandOptions & {
    attributes: VideoImportCreate & { torrentfile?: string }
  }) {
    const { attributes } = options
    const path = '/api/v1/videos/imports'

    let attaches: any = {}
    if (attributes.torrentfile) attaches = { torrentfile: attributes.torrentfile }

    return unwrapBody<VideoImport>(this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  getMyVideoImports (options: OverrideCommandOptions & {
    sort?: string
  } = {}) {
    const { sort } = options
    const path = '/api/v1/users/me/videos/imports'

    const query = {}
    if (sort) query['sort'] = sort

    return this.getRequestBody<ResultList<VideoImport>>({
      ...options,

      path,
      query: { sort },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
