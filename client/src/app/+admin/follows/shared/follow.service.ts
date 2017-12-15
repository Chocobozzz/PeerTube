import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/primeng'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { AccountFollow, ResultList } from '../../../../../../shared'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../../../shared'

@Injectable()
export class FollowService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/server'

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

  follow (notEmptyHosts: string[]) {
    const body = {
      hosts: notEmptyHosts
    }

    return this.authHttp.post(FollowService.BASE_APPLICATION_URL + '/following', body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  unfollow (follow: AccountFollow) {
    return this.authHttp.delete(FollowService.BASE_APPLICATION_URL + '/following/' + follow.following.host)
      .map(this.restExtractor.extractDataBool)
      .catch(res => this.restExtractor.handleError(res))
  }
}
