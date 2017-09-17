import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { SortMeta } from 'primeng/components/common/sortmeta'

import { RestExtractor, RestPagination, RestService } from '../../../shared'
import { Utils } from '../../../shared'
import { BlacklistedVideo, ResultList } from '../../../../../../shared'

@Injectable()
export class BlacklistService {
  private static BASE_BLACKLISTS_URL = '/api/v1/blacklist/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getBlacklist (pagination: RestPagination, sort: SortMeta): Observable<ResultList<BlacklistedVideo>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<BlacklistedVideo>>(BlacklistService.BASE_BLACKLISTS_URL, { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .map(res => this.restExtractor.applyToResultListData(res, this.formatBlacklistedVideo.bind(this)))
                        .catch(res => this.restExtractor.handleError(res))
  }

  removeVideoFromBlacklist (entry: BlacklistedVideo) {
    return this.authHttp.delete(BlacklistService.BASE_BLACKLISTS_URL + entry.id)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  private formatBlacklistedVideo (blacklistedVideo: BlacklistedVideo) {
    return Object.assign(blacklistedVideo, {
      createdAt: Utils.dateToHuman(blacklistedVideo.createdAt)
    })
  }
}
