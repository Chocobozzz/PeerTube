import { catchError } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, UserService } from '@app/core'
import { TwoFactorEnableResult } from '@peertube/peertube-models'

@Injectable()
export class TwoFactorService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  // ---------------------------------------------------------------------------

  requestTwoFactor (options: {
    userId: number
    currentPassword: string
  }) {
    const { userId, currentPassword } = options

    const url = UserService.BASE_USERS_URL + userId + '/two-factor/request'

    return this.authHttp.post<TwoFactorEnableResult>(url, { currentPassword })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  confirmTwoFactorRequest (options: {
    userId: number
    requestToken: string
    otpToken: string
  }) {
    const { userId, requestToken, otpToken } = options

    const url = UserService.BASE_USERS_URL + userId + '/two-factor/confirm-request'

    return this.authHttp.post(url, { requestToken, otpToken })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  disableTwoFactor (options: {
    userId: number
    currentPassword?: string
  }) {
    const { userId, currentPassword } = options

    const url = UserService.BASE_USERS_URL + userId + '/two-factor/disable'

    return this.authHttp.post(url, { currentPassword })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
