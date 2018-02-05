import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { BlacklistedVideo, ResultList } from '../../../../../shared'
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

  listBlacklist (pagination: RestPagination, sort: SortMeta): Observable<ResultList<BlacklistedVideo>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<BlacklistedVideo>>(VideoBlacklistService.BASE_VIDEOS_URL + 'blacklist', { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  removeVideoFromBlacklist (videoId: number) {
    return this.authHttp.delete(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist')
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  blacklistVideo (videoId: number) {
    return this.authHttp.post(VideoBlacklistService.BASE_VIDEOS_URL + videoId + '/blacklist', {})
               .map(this.restExtractor.extractDataBool)
               .catch(res => this.restExtractor.handleError(res))
  }
}
