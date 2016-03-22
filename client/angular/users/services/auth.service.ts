import { Injectable } from 'angular2/core';
import { Http, Response, Headers, URLSearchParams } from 'angular2/http';
import { Observable, Subject } from 'rxjs/Rx';

import { Token } from '../models/token';
import { AuthStatus } from '../models/authStatus';

@Injectable()
export class AuthService {
  private _loginChanged = new Subject<AuthStatus>();

  private _baseLoginUrl = '/api/v1/users/token';
  private _clientId = '56f055587305d40b21904240';
  private _clientSecret = 'megustalabanana';

  loginChanged$ = this._loginChanged.asObservable();

  constructor (private http: Http) {}

  login(username: string, password: string) {
    let body = new URLSearchParams();
    body.set('client_id', this._clientId);
    body.set('client_secret', this._clientSecret);
    body.set('response_type', 'code');
    body.set('grant_type', 'password');
    body.set('scope', 'upload');
    body.set('username', username);
    body.set('password', password);

    let headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');

    let options = {
      headers: headers
    }

    return this.http.post(this._baseLoginUrl, body.toString(), options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  logout() {
    // TODO make HTTP request
  }

  setStatus(status: AuthStatus) {
    this._loginChanged.next(status);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
