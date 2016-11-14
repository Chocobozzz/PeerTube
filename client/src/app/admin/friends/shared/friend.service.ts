import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { Friend } from './friend.model';
import { AuthHttp, RestExtractor } from '../../../shared';

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL: string = '/api/v1/pods/';

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getFriends(): Observable<Friend[]> {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL)
                        // Not implemented as a data list by the server yet
                        // .map(this.restExtractor.extractDataList)
                        .map((res) => res.json())
                        .catch((res) => this.restExtractor.handleError(res));
  }

  makeFriends(notEmptyHosts) {
    const body = {
      hosts: notEmptyHosts
    };

    return this.authHttp.post(FriendService.BASE_FRIEND_URL + 'makefriends', body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res));
  }

  quitFriends() {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL + 'quitfriends')
                        .map(res => res.status)
                        .catch((res) => this.restExtractor.handleError(res));
  }
}
