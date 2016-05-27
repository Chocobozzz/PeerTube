import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response, URLSearchParams } from '@angular/http';
import { Observable, Subject } from 'rxjs/Rx';

import { AuthStatus } from './auth-status.model';
import { User } from './user.model';

@Injectable()
export class AuthService {
  loginChanged$;

  private _loginChanged;
  private _baseLoginUrl = '/api/v1/users/token';
  private _baseClientUrl = '/api/v1/users/client';
  private _clientId = '';
  private _clientSecret = '';

  constructor (private http: Http) {
    this._loginChanged = new Subject<AuthStatus>();
    this.loginChanged$ = this._loginChanged.asObservable();

    // Fetch the client_id/client_secret
    // FIXME: save in local storage?
    this.http.get(this._baseClientUrl)
      .map(res => res.json())
      .catch(this.handleError)
      .subscribe(
        result => {
          this._clientId = result.client_id;
          this._clientSecret = result.client_secret;
          console.log('Client credentials loaded.');
        },
        error => {
          alert(error);
        }
      );
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
