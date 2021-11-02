import { Observable } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { CommonVideoParams, Video, VideoService } from '@app/shared/shared-main'
import { ResultList, VideoInclude } from '@shared/models'

@Injectable()
export class VideoAdminService {

  constructor (
    private videoService: VideoService,
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getAdminVideos (
    options: CommonVideoParams & { pagination: RestPagination, search?: string }
  ): Observable<ResultList<Video>> {
    const { pagination, search } = options

    let params = new HttpParams()
    params = this.videoService.buildCommonVideosParams({ params, ...options })

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

  buildAdminInputFilter (): AdvancedInputFilter[] {
    return [
      {
        title: $localize`Videos scope`,
        children: [
          {
            queryParams: { search: 'isLocal:false' },
            label: $localize`Remote videos`
          },
          {
            queryParams: { search: 'isLocal:true' },
            label: $localize`Local videos`
          }
        ]
      },

      {
        title: $localize`Include/Exclude`,
        children: [
          {
            queryParams: { search: 'excludeMuted' },
            label: $localize`Exclude muted accounts`
          }
        ]
      }
    ]
  }

  private buildAdminParamsFromSearch (search: string, params: HttpParams) {
    let include = VideoInclude.BLACKLISTED |
      VideoInclude.BLOCKED_OWNER |
      VideoInclude.HIDDEN_PRIVACY |
      VideoInclude.NOT_PUBLISHED_STATE |
      VideoInclude.FILES

    if (!search) return this.restService.addObjectParams(params, { include })

    const filters = this.restService.parseQueryStringFilter(search, {
      isLocal: {
        prefix: 'isLocal:',
        isBoolean: true
      },
      excludeMuted: {
        prefix: 'excludeMuted',
        handler: () => true
      }
    })

    if (filters.excludeMuted) {
      include &= ~VideoInclude.BLOCKED_OWNER

      filters.excludeMuted = undefined
    }

    return this.restService.addObjectParams(params, { ...filters, include })
  }
}
