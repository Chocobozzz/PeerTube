import { catchError, map, concatMap, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { from as observableFrom, Observable } from 'rxjs'
import { VideoBlacklist, VideoBlacklistType, ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'
// import { ComponentPagination } from '../rest/component-pagination.model'
// import { VideoSortField } from '../video/sort-field.type'

@Injectable()
export class VideoBlacklistService {
  private static BASE_VIDEOS_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listBlacklist (pagination: RestPagination, sort: SortMeta, type: VideoBlacklistType): Observable<ResultList<VideoBlacklist>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.set('type', type.toString())

    return this.authHttp.get<ResultList<VideoBlacklist>>(VideoBlacklistService.BASE_VIDEOS_URL + 'blacklist', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  removeVideoFromBlacklist (videoIdArgs: number | number[]) {
    const videoIds = Array.isArray(videoIdArgs) ? videoIdArgs : [ videoIdArgs ]

    return observableFrom(videoIds)
      .pipe(
        concatMap(id => this.authHttp.delete(VideoBlacklistService.BASE_VIDEOS_URL + id + '/blacklist')),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  blacklistVideo (videoId: number, reason: string, unfederate: boolean) {
    const body = {
      unfederate,
      reason
    }

    return this.authHttp.post(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
