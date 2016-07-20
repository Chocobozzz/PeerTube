import { Injectable } from '@angular/core';
import {
  ConnectionBackend,
  Headers,
  Http,
  Request,
  RequestMethod,
  RequestOptions,
  RequestOptionsArgs,
  Response
} from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { AuthService } from './auth.service';

@Injectable()
export class AuthHttp extends Http {
  constructor(backend: ConnectionBackend, defaultOptions: RequestOptions, private authService: AuthService) {
    super(backend, defaultOptions);
  }

  request(url: string | Request, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {};

    options.headers = new Headers();
    this.setAuthorizationHeader(options.headers);

    return super.request(url, options)
                .catch((err) => {
                  if (err.status === 401) {
                    return this.handleTokenExpired(err, url, options);
                  }

                  return Observable.throw(err);
                });
  }

  delete(url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {};
    options.method = RequestMethod.Delete;

    return this.request(url, options);
  }

  get(url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {};
    options.method = RequestMethod.Get;

    return this.request(url, options);
  }

  post(url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {};
    options.method = RequestMethod.Post;

    return this.request(url, options);
  }

  put(url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {};
    options.method = RequestMethod.Put;

    return this.request(url, options);
  }

  private handleTokenExpired(err: Response, url: string | Request, options: RequestOptionsArgs) {
    return this.authService.refreshAccessToken().flatMap(() => {
      this.setAuthorizationHeader(options.headers);

      return super.request(url, options);
    });
  }

  private setAuthorizationHeader(headers: Headers) {
    headers.set('Authorization', `${this.authService.getTokenType()} ${this.authService.getToken()}`);
  }
}
