import { SortMeta } from 'primeng/api'
import { from as observableFrom, Observable } from 'rxjs'
import { catchError, concatMap, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { arrayify } from '@peertube/peertube-core-utils'
import { ResultList, VideoBlacklist, VideoBlacklistType, VideoBlacklistType_Type } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'

@Injectable()
export class VideoBlockService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_VIDEOS_URL = environment.apiUrl + '/api/v1/videos/'

  listBlocks (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    type?: VideoBlacklistType_Type
  }): Observable<ResultList<VideoBlacklist>> {
    const { pagination, sort, search, type } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      const filters = this.restService.parseQueryStringFilter(search, {
        type: {
          prefix: 'type:',
          handler: v => {
            if (v === 'manual') return VideoBlacklistType.MANUAL
            if (v === 'auto') return VideoBlacklistType.AUTO_BEFORE_PUBLISHED

            return undefined
          }
        }
      })

      params = this.restService.addObjectParams(params, filters)
    }
    if (type) params = params.append('type', type.toString())

    return this.authHttp.get<ResultList<VideoBlacklist>>(VideoBlockService.BASE_VIDEOS_URL + 'blacklist', { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  unblockVideo (videoIdArgs: number | number[]) {
    const videoIds = arrayify(videoIdArgs)

    return observableFrom(videoIds)
      .pipe(
        concatMap(id => this.authHttp.delete(VideoBlockService.BASE_VIDEOS_URL + id + '/blacklist')),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  blockVideo (options: {
    videoId: number
    reason?: string
    unfederate: boolean
  }[]) {
    return observableFrom(options)
      .pipe(
        concatMap(({ videoId, unfederate, reason }) => {
          const body = { unfederate, reason }

          return this.authHttp.post(VideoBlockService.BASE_VIDEOS_URL + videoId + '/blacklist', body)
        }),
        toArray(),
        catchError(res => this.restExtractor.handleError(res))
      )
  }
}
