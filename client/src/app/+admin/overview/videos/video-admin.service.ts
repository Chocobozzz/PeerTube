import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { FilterDef } from '@app/shared/shared-forms/advanced-input-filter.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoListParams, VideoService } from '@app/shared/shared-main/video/video.service'
import { getAllPrivacies, omit } from '@peertube/peertube-core-utils'
import { ResultList, VideoInclude, VideoPrivacy } from '@peertube/peertube-models'
import { Observable } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'

@Injectable()
export class VideoAdminService {
  private videoService = inject(VideoService)
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  getAdminVideos (
    options: VideoListParams & { pagination: RestPagination, search?: string }
  ): Observable<ResultList<Video>> {
    const { pagination, search } = options

    let params = new HttpParams()
    params = this.videoService.buildVideoListParams({ params, ...omit(options, [ 'search', 'pagination' ]) })

    params = params.set('start', pagination.start.toString())
      .set('count', pagination.count.toString())

    params = this.buildAdminParamsFromSearch(search, params)

    return this.authHttp
      .get<ResultList<Video>>(VideoService.BASE_VIDEO_URL, { params })
      .pipe(
        switchMap(res => this.videoService.extractVideos(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  buildAdminInputFilter (): FilterDef[] {
    return [
      {
        type: 'checkbox',
        key: 'nsfw',
        label: $localize`Sensitive videos`
      },

      {
        type: 'options',
        key: 'isLive',
        title: $localize`Video type`,
        options: [
          { value: 'false', label: $localize`VOD` },
          { value: 'true', label: $localize`Live` }
        ]
      },

      {
        type: 'options',
        key: 'videoFiles',
        title: $localize`Video files (local only)`,
        options: [
          { value: 'webVideos-true', label: $localize`With Web Videos`, rawToken: 'webVideos:true isLocal:true' },
          { value: 'webVideos-false', label: $localize`Without Web Videos`, rawToken: 'webVideos:false isLocal:true' },
          { value: 'hls-true', label: $localize`With HLS`, rawToken: 'hls:true isLocal:true' },
          { value: 'hls-false', label: $localize`Without HLS`, rawToken: 'hls:false isLocal:true' }
        ]
      },

      {
        type: 'options',
        key: 'isLocal',
        title: $localize`Videos scope`,
        options: [
          { value: 'false', label: $localize`Remote videos` },
          { value: 'true', label: $localize`Local videos` }
        ]
      },

      {
        type: 'checkbox',
        key: 'excludeMuted',
        label: $localize`Exclude muted accounts`
      },

      {
        type: 'checkbox',
        key: 'excludePublic',
        label: $localize`Exclude public videos`
      }
    ]
  }

  private buildAdminParamsFromSearch (search: string, params: HttpParams) {
    let include = VideoInclude.BLACKLISTED |
      VideoInclude.BLOCKED_OWNER |
      VideoInclude.NOT_PUBLISHED_STATE |
      VideoInclude.FILES |
      VideoInclude.SOURCE |
      VideoInclude.AUTOMATIC_TAGS

    let privacyOneOf = getAllPrivacies()

    if (!search) return this.restService.addObjectParams(params, { include, privacyOneOf })

    const filters = this.restService.parseQueryStringFilter(search, {
      isLocal: {
        prefix: 'isLocal:',
        isBoolean: true
      },
      hasHLSFiles: {
        prefix: 'hls:',
        isBoolean: true
      },
      hasWebVideoFiles: {
        prefix: 'webVideos:',
        isBoolean: true
      },
      isLive: {
        prefix: 'isLive:',
        isBoolean: true
      },
      excludeMuted: {
        prefix: 'excludeMuted',
        handler: () => true
      },
      excludePublic: {
        prefix: 'excludePublic',
        handler: () => true
      },
      autoTagOneOf: {
        prefix: 'autoTag:',
        multiple: true
      },
      nsfw: {
        prefix: 'nsfw:',
        isBoolean: true
      }
    })

    if (filters.excludeMuted) {
      include &= ~VideoInclude.BLOCKED_OWNER

      filters.excludeMuted = undefined
    }

    if (filters.excludePublic) {
      privacyOneOf = [ VideoPrivacy.PRIVATE, VideoPrivacy.UNLISTED, VideoPrivacy.INTERNAL, VideoPrivacy.PASSWORD_PROTECTED ]

      filters.excludePublic = undefined
    }

    return this.restService.addObjectParams(params, { ...filters, include, privacyOneOf })
  }
}
