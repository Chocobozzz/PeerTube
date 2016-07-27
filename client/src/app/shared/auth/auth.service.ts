import { Injectable } from '@angular/core';
import { Headers, Http, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { AuthStatus } from './auth-status.model';
import { User } from './user.model';

@Injectable()
export class AuthService {
  private static BASE_CLIENT_URL = '/api/v1/users/client';
  private static BASE_TOKEN_URL = '/api/v1/users/token';

  loginChangedSource: Observable<AuthStatus>;

  private clientId: string;
  private clientSecret: string;
  private loginChanged: Subject<AuthStatus>;
  private user: User = null;

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

    // Return null if there is nothing to load
    this.user = User.load();
  }

  getRefreshToken() {
    if (this.user === null) return null;

    return this.user.getRefreshToken();
  }

  getRequestHeaderValue() {
    return `${this.getTokenType()} ${this.getAccessToken()}`;
  }

  getAccessToken() {
    if (this.user === null) return null;

    return this.user.getAccessToken();
  }

  getTokenType() {
    if (this.user === null) return null;

    return this.user.getTokenType();
  }

  getUser(): User {
    return this.user;
  }

  isLoggedIn() {
    if (this.getAccessToken()) {
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

    return this.http.post(AuthService.BASE_TOKEN_URL, body.toString(), options)
                    .map(res => res.json())
                    .map(res => {
                      res.username = username;
                      return res;
                    })
                    .map(res => this.handleLogin(res))
                    .catch(this.handleError);
  }

  logout() {
    // TODO: make an HTTP request to revoke the tokens
    this.user = null;
    User.flush();

    this.setStatus(AuthStatus.LoggedOut);
  }

  refreshAccessToken() {
    console.log('Refreshing token...');

    const refreshToken = this.getRefreshToken();

    let body = new URLSearchParams();
    body.set('refresh_token', refreshToken);
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
    body.set('response_type', 'code');
    body.set('grant_type', 'refresh_token');

    let headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');

    let options = {
      headers: headers
    };

    return this.http.post(AuthService.BASE_TOKEN_URL, body.toString(), options)
                    .map(res => res.json())
                    .map(res => this.handleRefreshToken(res))
                    .catch(this.handleError);
  }

  private setStatus(status: AuthStatus) {
    this.loginChanged.next(status);
  }

  private handleLogin (obj: any) {
    const username = obj.username;
    const hash_tokens = {
      access_token: obj.access_token,
      token_type: obj.token_type,
      refresh_token: obj.refresh_token
    };

    this.user = new User(username, hash_tokens);
    this.user.save();

    this.setStatus(AuthStatus.LoggedIn);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json() || { error: 'Server error' });
  }

  private handleRefreshToken (obj: any) {
    this.user.refreshTokens(obj.access_token, obj.refresh_token);
    this.user.save();
  }
}
