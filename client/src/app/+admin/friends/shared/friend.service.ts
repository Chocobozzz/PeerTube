import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'

import { ServerDataSource } from 'ng2-smart-table'

import { AuthHttp, RestExtractor, RestDataSource, ResultList } from '../../../shared'
import { Pod } from '../../../../../../shared'

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL = API_URL + '/api/v1/pods/'

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getDataSource () {
    return new RestDataSource(this.authHttp, FriendService.BASE_FRIEND_URL)
  }

  makeFriends (notEmptyHosts: String[]) {
    const body = {
      hosts: notEmptyHosts
    }

    return this.authHttp.post(FriendService.BASE_FRIEND_URL + 'makefriends', body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  quitFriends () {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL + 'quitfriends')
                        .map(res => res.status)
                        .catch((res) => this.restExtractor.handleError(res))
  }

  removeFriend (friend: Pod) {
    return this.authHttp.delete(FriendService.BASE_FRIEND_URL + friend.id)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res))
  }
}
