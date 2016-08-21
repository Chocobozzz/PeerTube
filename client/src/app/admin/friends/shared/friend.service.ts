import { Injectable } from '@angular/core';
import { Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { Friend } from './friend.model';
import { AuthHttp, AuthService } from '../../../shared';

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL: string = '/api/v1/pods/';

  constructor (
    private authHttp: AuthHttp,
    private authService: AuthService
  ) {}

  getFriends(): Observable<Friend[]> {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL)
                        .map(res => <Friend[]>res.json())
                        .catch(this.handleError);
  }

  makeFriends(notEmptyUrls) {
    const body = {
      urls: notEmptyUrls
    };

    return this.authHttp.post(FriendService.BASE_FRIEND_URL + 'makefriends', body)
                        .map(res => res.status)
                        .catch(this.handleError);
  }

  quitFriends() {
    return this.authHttp.get(FriendService.BASE_FRIEND_URL + 'quitfriends')
                        .map(res => res.status)
                        .catch(this.handleError);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
