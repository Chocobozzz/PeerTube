import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { SortMeta } from 'primeng/primeng'

import { RestExtractor, RestPagination, RestService } from '../../../shared'
import { AccountFollow, ResultList } from '../../../../../../shared'

@Injectable()
export class FollowService {
  private static BASE_APPLICATION_URL = API_URL + '/api/v1/application'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getFollowing (pagination: RestPagination, sort: SortMeta): Observable<ResultList<AccountFollow>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<Account>>(FollowService.BASE_APPLICATION_URL + '/following', { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  getFollowers (pagination: RestPagination, sort: SortMeta): Observable<ResultList<AccountFollow>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<Account>>(FollowService.BASE_APPLICATION_URL + '/followers', { params })
      .map(res => this.restExtractor.convertResultListDateToHuman(res))
      .catch(res => this.restExtractor.handleError(res))
  }

  follow (notEmptyHosts: String[]) {
    const body = {
      hosts: notEmptyHosts
    }

    return this.authHttp.post(FollowService.BASE_APPLICATION_URL + '/follow', body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }
}
