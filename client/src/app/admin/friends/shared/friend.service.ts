import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { Friend } from './friend.model';
import { AuthHttp, RestExtractor, ResultList } from '../../../shared';

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL: string = '/api/v1/pods/';

  constructor (
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getFriends() {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL)
                        .map(this.restExtractor.extractDataList)
                        .map(this.extractFriends)
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

  private extractFriends(result: ResultList) {
    const friends: Friend[] = result.data;
    const totalFriends = result.total;

    return { friends, totalFriends };
  }
}
