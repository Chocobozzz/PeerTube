import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { AuthService } from '../shared';

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL: string = '/api/v1/pods/';

  constructor (private http: Http, private authService: AuthService) {}

  makeFriends() {
    const headers = this.authService.getRequestHeader();
    return this.http.get(FriendService.BASE_FRIEND_URL + 'makefriends', { headers })
                    .map(res => res.status)
                    .catch(this.handleError);
  }

  quitFriends() {
    const headers = this.authService.getRequestHeader();
    return this.http.get(FriendService.BASE_FRIEND_URL + 'quitfriends', { headers })
                    .map(res => res.status)
                    .catch(this.handleError);
  }

  private handleError (error: Response): Observable<number> {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
