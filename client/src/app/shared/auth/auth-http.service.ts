import { Injectable } from '@angular/core'
import {
  ConnectionBackend,
  Headers,
  Http,
  Request,
  RequestMethod,
  RequestOptions,
  RequestOptionsArgs,
  Response,
  XHRBackend
} from '@angular/http'
import { Observable } from 'rxjs/Observable'

import { AuthService } from '../../core'

@Injectable()
export class AuthHttp extends Http {
  constructor (backend: ConnectionBackend, defaultOptions: RequestOptions, private authService: AuthService) {
    super(backend, defaultOptions)
  }

  request (url: string | Request, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {}

    options.headers = new Headers()
    this.setAuthorizationHeader(options.headers)

    return super.request(url, options)
                .catch((err) => {
                  if (err.status === 401) {
                    return this.handleTokenExpired(url, options)
                  }

                  return Observable.throw(err)
                })
  }

  delete (url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {}
    options.method = RequestMethod.Delete

    return this.request(url, options)
  }

  get (url: string, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {}
    options.method = RequestMethod.Get

    return this.request(url, options)
  }

  post (url: string, body: any, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {}
    options.method = RequestMethod.Post
    options.body = body

    return this.request(url, options)
  }

  put (url: string, body: any, options?: RequestOptionsArgs): Observable<Response> {
    if (!options) options = {}
    options.method = RequestMethod.Put
    options.body = body

    return this.request(url, options)
  }

  private handleTokenExpired (url: string | Request, options: RequestOptionsArgs) {
    return this.authService.refreshAccessToken()
                           .flatMap(() => {
                             this.setAuthorizationHeader(options.headers)

                             return super.request(url, options)
                           })
  }

  private setAuthorizationHeader (headers: Headers) {
    headers.set('Authorization', this.authService.getRequestHeaderValue())
  }
}

export function useFactory (backend: XHRBackend, defaultOptions: RequestOptions, authService: AuthService) {
  return new AuthHttp(backend, defaultOptions, authService)
}

export const AUTH_HTTP_PROVIDERS = [
  {
    provide: AuthHttp,
    useFactory,
    deps: [ XHRBackend, RequestOptions, AuthService ]
  }
]
