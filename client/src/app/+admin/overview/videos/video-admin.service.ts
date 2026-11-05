import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoListParams, VideoService } from '@app/shared/shared-main/video/video.service'
import { getAllPrivacies } from '@peertube/peertube-core-utils'
import { ResultList, VideoInclude } from '@peertube/peertube-models'
import { Observable } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'

@Injectable()
export class VideoAdminService {
  private videoService = inject(VideoService)
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  listAdminVideos (
    options: VideoListParams & {
      pagination: RestPagination
      search?: string
      excludeMuted?: boolean
    }
  ): Observable<ResultList<Video>> {
    const { pagination, search, excludeMuted, ...listParamsOptions } = options

    let params = new HttpParams()
    params = this.videoService.buildVideoListParams({
      params,
      ...listParamsOptions,

      privacyOneOf: listParamsOptions.privacyOneOf ?? getAllPrivacies()
    })

    let include = VideoInclude.BLACKLISTED |
      VideoInclude.BLOCKED_OWNER |
      VideoInclude.NOT_PUBLISHED_STATE |
      VideoInclude.FILES |
      VideoInclude.SOURCE |
      VideoInclude.AUTOMATIC_TAGS

    if (excludeMuted) {
      include &= ~VideoInclude.BLOCKED_OWNER
    }

    params = this.restService.addObjectParams(params, {
      include,
      search,
      start: pagination.start,
      count: pagination.count
    })

    return this.authHttp
      .get<ResultList<Video>>(VideoService.BASE_VIDEO_URL, { params })
      .pipe(
        switchMap(res => this.videoService.extractVideos(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
