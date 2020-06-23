import { SortMeta } from 'primeng/api'
import { from as observableFrom, Observable } from 'rxjs'
import { catchError, concatMap, map, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ResultList, VideoBlacklist, VideoBlacklistType } from '@shared/models'
import { environment } from '../../../environments/environment'

@Injectable()
export class VideoBlockService {
  private static BASE_VIDEOS_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listBlocks (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    type?: VideoBlacklistType
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
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  unblockVideo (videoIdArgs: number | number[]) {
    const videoIds = Array.isArray(videoIdArgs) ? videoIdArgs : [ videoIdArgs ]

    return observableFrom(videoIds)
      .pipe(
        concatMap(id => this.authHttp.delete(VideoBlockService.BASE_VIDEOS_URL + id + '/blacklist')),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  blockVideo (videoId: number, reason: string, unfederate: boolean) {
    const body = {
      unfederate,
      reason
    }

    return this.authHttp.post(VideoBlockService.BASE_VIDEOS_URL + videoId + '/blacklist', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
