import { Injectable } from 'angular2/core';
import { Http, Response, Headers, URLSearchParams, RequestOptions } from 'angular2/http';
import { Observable, Subject } from 'rxjs/Rx';

import { AuthStatus } from '../models/authStatus';
import { User } from '../models/user';

@Injectable()
export class AuthService {
  loginChanged$;

  private _loginChanged;
  private _baseLoginUrl = '/api/v1/users/token';
  private _clientId = '56f055587305d40b21904240';
  private _clientSecret = 'megustalabanana';

  constructor (private http: Http) {
    this._loginChanged = new Subject<AuthStatus>();
    this.loginChanged$ = this._loginChanged.asObservable();
  }

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
    };

    return this.http.post(this._baseLoginUrl, body.toString(), options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  logout() {
    // TODO make HTTP request
  }

  getRequestHeader(): Headers {
    return new Headers({ 'Authorization': `${this.getTokenType()} ${this.getToken()}` });
  }

  getAuthRequestOptions(): RequestOptions {
    return new RequestOptions({ headers: this.getRequestHeader() });
  }

  getToken(): string {
    return localStorage.getItem('access_token');
  }

  getTokenType(): string {
    return localStorage.getItem('token_type');
  }

  getUser(): User {
    if (this.isLoggedIn() === false) {
      return null;
    }

    const user = User.load();

    return user;
  }

  isLoggedIn(): boolean {
    if (this.getToken()) {
      return true;
    } else {
      return false;
    }
  }

  setStatus(status: AuthStatus) {
    this._loginChanged.next(status);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json() || { error: 'Server error' });
  }
}
