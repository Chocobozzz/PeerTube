import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Rx';

@Injectable()
export class FriendService {
  private static BASE_FRIEND_URL: string = '/api/v1/pods/';

  constructor (private http: Http) {}

  makeFriends() {
    return this.http.get(FriendService.BASE_FRIEND_URL + 'makefriends')
                    .map(res => res.status)
                    .catch(this.handleError);
  }

  quitFriends() {
    return this.http.get(FriendService.BASE_FRIEND_URL + 'quitfriends')
                    .map(res => res.status)
                    .catch(this.handleError);
  }

  private handleError (error: Response): Observable<number> {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
