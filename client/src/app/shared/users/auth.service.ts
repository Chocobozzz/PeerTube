import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { AuthStatus } from './auth-status.model';
import { User } from './user.model';

@Injectable()
export class AuthService {
  private static BASE_CLIENT_URL = '/api/v1/users/client';
  private static BASE_LOGIN_URL = '/api/v1/users/token';

  loginChangedSource: Observable<AuthStatus>;

  private clientId: string;
  private clientSecret: string;
  private loginChanged: Subject<AuthStatus>;

  constructor(private http: Http) {
    this.loginChanged = new Subject<AuthStatus>();
    this.loginChangedSource = this.loginChanged.asObservable();

    // Fetch the client_id/client_secret
    // FIXME: save in local storage?
    this.http.get(AuthService.BASE_CLIENT_URL)
      .map(res => res.json())
      .catch(this.handleError)
      .subscribe(
        result => {
          this.clientId = result.client_id;
          this.clientSecret = result.client_secret;
          console.log('Client credentials loaded.');
        },
        error => {
          alert(error);
        }
      );
  }

  getAuthRequestOptions(): RequestOptions {
    return new RequestOptions({ headers: this.getRequestHeader() });
  }

  getRequestHeader() {
    return new Headers({ 'Authorization': this.getRequestHeaderValue() });
  }

  getRequestHeaderValue() {
    return `${this.getTokenType()} ${this.getToken()}`;
  }

  getToken() {
    return localStorage.getItem('access_token');
  }

  getTokenType() {
    return localStorage.getItem('token_type');
  }

  getUser(): User {
    if (this.isLoggedIn() === false) {
      return null;
    }

    const user = User.load();

    return user;
  }

  isLoggedIn() {
    if (this.getToken()) {
      return true;
    } else {
      return false;
    }
  }

  login(username: string, password: string) {
    let body = new URLSearchParams();
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
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

    return this.http.post(AuthService.BASE_LOGIN_URL, body.toString(), options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  logout() {
    // TODO make HTTP request
  }

  setStatus(status: AuthStatus) {
    this.loginChanged.next(status);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json() || { error: 'Server error' });
  }
}
