import { Injectable } from '@angular/core';
import { Headers, Http, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { AuthStatus } from './auth-status.model';
import { AuthUser } from './auth-user.model';

@Injectable()
export class AuthService {
  private static BASE_CLIENT_URL = '/api/v1/clients/local';
  private static BASE_TOKEN_URL = '/api/v1/users/token';
  private static BASE_USER_INFORMATIONS_URL = '/api/v1/users/me';

  loginChangedSource: Observable<AuthStatus>;

  private clientId: string;
  private clientSecret: string;
  private loginChanged: Subject<AuthStatus>;
  private user: AuthUser = null;

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
    this.user = AuthUser.load();
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

  getUser(): AuthUser {
    return this.user;
  }

  isAdmin() {
    if (this.user === null) return false;

    return this.user.isAdmin();
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
                    .flatMap(res => this.fetchUserInformations(res))
                    .map(res => this.handleLogin(res))
                    .catch(this.handleError);
  }

  logout() {
    // TODO: make an HTTP request to revoke the tokens
    this.user = null;
    AuthUser.flush();

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

  private fetchUserInformations (obj: any) {
    // Do not call authHttp here to avoid circular dependencies headaches

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${obj.access_token}`);

    return this.http.get(AuthService.BASE_USER_INFORMATIONS_URL, { headers })
             .map(res => res.json())
             .map(res => {
               obj.id = res.id;
               obj.role = res.role;
               return obj;
             }
    );
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json() || { error: 'Server error' });
  }

  private handleLogin (obj: any) {
    const id = obj.id;
    const username = obj.username;
    const role = obj.role;
    const hashTokens = {
      access_token: obj.access_token,
      token_type: obj.token_type,
      refresh_token: obj.refresh_token
    };

    this.user = new AuthUser({ id, username, role }, hashTokens);
    this.user.save();

    this.setStatus(AuthStatus.LoggedIn);
  }

  private handleRefreshToken (obj: any) {
    this.user.refreshTokens(obj.access_token, obj.refresh_token);
    this.user.save();
  }

  private setStatus(status: AuthStatus) {
    this.loginChanged.next(status);
  }

}
