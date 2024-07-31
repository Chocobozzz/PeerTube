import { Observable, of, throwError as observableThrowError } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import { HTTP_INTERCEPTORS, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { Injectable, Injector } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { HttpStatusCode, OAuth2ErrorCode, PeerTubeProblemDocument, ServerErrorCode } from '@peertube/peertube-models'

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService: AuthService

  // https://github.com/angular/angular/issues/18224#issuecomment-316957213
  constructor (private injector: Injector, private router: Router) {}

  intercept (req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.authService === undefined) {
      this.authService = this.injector.get(AuthService)
    }

    const authReq = this.cloneRequestWithAuth(req)

    // Pass on the cloned request instead of the original request
    // Catch 401 errors (refresh token expired)
    return next.handle(authReq)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const error = err.error as PeerTubeProblemDocument
          const isOTPMissingError = this.authService.isOTPMissingError(err)

          if (error && error.code === ServerErrorCode.CURRENT_PASSWORD_IS_INVALID) {
            return observableThrowError(() => err)
          }

          if (!isOTPMissingError) {
            if (err.status === HttpStatusCode.UNAUTHORIZED_401 && error && error.code === OAuth2ErrorCode.INVALID_TOKEN) {
              return this.handleTokenExpired(req, next)
            }

            if (err.status === HttpStatusCode.UNAUTHORIZED_401) {
              return this.handleNotAuthenticated(err)
            }
          }

          return observableThrowError(() => err)
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

  private handleNotAuthenticated (err: HttpErrorResponse): Observable<any> {
    this.router.navigate([ '/401' ], { state: { obj: err }, skipLocationChange: true })
    return of(err.message)
  }
}

export const AUTH_INTERCEPTOR_PROVIDER = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
}
