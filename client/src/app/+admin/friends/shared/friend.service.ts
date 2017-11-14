import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { SortMeta } from 'primeng/primeng'

import { RestExtractor, RestPagination, RestService } from '../../../shared'
import { Pod, ResultList } from '../../../../../../shared'

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL = API_URL + '/api/v1/pods/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getFollowing (pagination: RestPagination, sort: SortMeta): Observable<ResultList<Pod>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<Account>>(API_URL + '/followers', { params })
                        .map(res => this.restExtractor.convertResultListDateToHuman(res))
                        .catch(res => this.restExtractor.handleError(res))
  }

  follow (notEmptyHosts: String[]) {
    const body = {
      hosts: notEmptyHosts
    }

    return this.authHttp.post(API_URL + '/follow', body)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  quitFriends () {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL + 'quit-friends')
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }

  removeFriend (friend: Pod) {
    return this.authHttp.delete(FriendService.BASE_FRIEND_URL + friend.id)
                        .map(this.restExtractor.extractDataBool)
                        .catch(res => this.restExtractor.handleError(res))
  }
}
