import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { Observable } from 'rxjs'
import { VideoBlacklist, ResultList } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'

@Injectable()
export class VideoBlacklistService {
  private static BASE_VIDEOS_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listBlacklist (pagination: RestPagination, sort: SortMeta): Observable<ResultList<VideoBlacklist>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<VideoBlacklist>>(VideoBlacklistService.BASE_VIDEOS_URL + 'blacklist', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  removeVideoFromBlacklist (videoId: number) {
    return this.authHttp.delete(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist')
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  blacklistVideo (videoId: number, reason?: string) {
    const body = reason ? { reason } : {}

    return this.authHttp.post(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
