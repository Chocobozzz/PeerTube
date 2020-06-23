import { Observable, throwError as observableThrowError } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import { HTTP_INTERCEPTORS, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { Injectable, Injector } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService: AuthService

  // https://github.com/angular/angular/issues/18224#issuecomment-316957213
  constructor (private injector: Injector) {}

  intercept (req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.authService === undefined) {
      this.authService = this.injector.get(AuthService)
    }

    const authReq = this.cloneRequestWithAuth(req)

    // Pass on the cloned request instead of the original request
    // Catch 401 errors (refresh token expired)
    return next.handle(authReq)
               .pipe(
                 catchError(err => {
                   if (err.status === 401 && err.error && err.error.code === 'invalid_token') {
                     return this.handleTokenExpired(req, next)
                   }

                   return observableThrowError(err)
                 })
               )
  }

  private handleTokenExpired (req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return this.authService.refreshAccessToken()
               .pipe(
                 switchMap(() => {
                   const authReq = this.cloneRequestWithAuth(req)

                   return next.handle(authReq)
                 })
               )
  }

  private cloneRequestWithAuth (req: HttpRequest<any>) {
    const authHeaderValue = this.authService.getRequestHeaderValue()

    if (authHeaderValue === null) return req

    // Clone the request to add the new header
    return req.clone({ headers: req.headers.set('Authorization', authHeaderValue) })
  }
}

export const AUTH_INTERCEPTOR_PROVIDER = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
}
