import { catchError, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, UserService } from '@app/core'
import { UserRegister, UserRegistrationRequest } from '@peertube/peertube-models'

@Injectable()
export class SignupService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private userService = inject(UserService)

  directSignup (userCreate: UserRegister) {
    return this.authHttp.post(UserService.BASE_USERS_URL + 'register', userCreate)
      .pipe(
        tap(() => this.userService.setSignupInThisSession(true)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  requestSignup (userCreate: UserRegistrationRequest) {
    return this.authHttp.post(UserService.BASE_USERS_URL + 'registrations/request', userCreate)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  askSendVerifyEmail (email: string) {
    const url = `${UserService.BASE_USERS_URL}registrations/ask-send-verify-email`

    return this.authHttp.post(url, { email })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  verifyRegistrationEmail (options: {
    registrationId: number
    verificationString: string
  }) {
    const { registrationId, verificationString } = options

    const url = `${UserService.BASE_USERS_URL}registrations/${registrationId}/verify-email`
    const body = { verificationString }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  // ---------------------------------------------------------------------------

  getNewUsername (oldDisplayName: string, newDisplayName: string, currentUsername: string) {
    // Don't update display name, the user seems to have changed it
    if (this.displayNameToUsername(oldDisplayName) !== currentUsername) return currentUsername

    return this.displayNameToUsername(newDisplayName)
  }

  private displayNameToUsername (displayName: string) {
    if (!displayName) return ''

    return displayName
      .toLowerCase()
      .replace(/\s/g, '_')
      .replace(/[^a-z0-9_.]/g, '')
  }
}
