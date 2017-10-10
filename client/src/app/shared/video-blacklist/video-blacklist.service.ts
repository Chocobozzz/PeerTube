import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { SortMeta } from 'primeng/components/common/sortmeta'

import { RestExtractor, RestPagination, RestService } from '../rest'
import { Utils } from '../utils'
import { BlacklistedVideo, ResultList } from '../../../../../shared'

@Injectable()
export class VideoBlacklistService {
  private static BASE_VIDEOS_URL = API_URL + '/api/v1/videos/'

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
                        .map(res => this.restExtractor.applyToResultListData(res, this.formatBlacklistedVideo.bind(this)))
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

  private formatBlacklistedVideo (blacklistedVideo: BlacklistedVideo) {
    return Object.assign(blacklistedVideo, {
      createdAt: Utils.dateToHuman(blacklistedVideo.createdAt)
    })
  }
}
