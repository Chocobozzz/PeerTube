import { Injectable } from 'angular2/core';
import { Http, Response } from 'angular2/http';
import { Observable } from 'rxjs/Rx';

@Injectable()
export class FriendsService {
  private _baseFriendsUrl = '/api/v1/pods/';

  constructor (private http: Http) {}

  makeFriends() {
    return this.http.get(this._baseFriendsUrl + 'makefriends')
                    .map(res => <number> res.status)
                    .catch(this.handleError);
  }

  quitFriends() {
    return this.http.get(this._baseFriendsUrl + 'quitfriends')
                    .map(res => <number> res.status)
                    .catch(this.handleError);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
