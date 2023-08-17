import { catchError, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, UserService } from '@app/core'
import { UserRegister, UserRegistrationRequest } from '@peertube/peertube-models'

@Injectable()
export class SignupService {

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private userService: UserService
  ) { }

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

  verifyUserEmail (options: {
    userId: number
    verificationString: string
    isPendingEmail: boolean
  }) {
    const { userId, verificationString, isPendingEmail } = options

    const url = `${UserService.BASE_USERS_URL}${userId}/verify-email`
    const body = {
      verificationString,
      isPendingEmail
    }

    return this.authHttp.post(url, body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
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

  askSendVerifyEmail (email: string) {
    const url = UserService.BASE_USERS_URL + 'ask-send-verify-email'

    return this.authHttp.post(url, { email })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
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
