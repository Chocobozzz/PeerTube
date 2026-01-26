import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable, LOCALE_ID } from '@angular/core'
import { AuthService } from '@app/core/auth'
import { arrayify, getCompleteLocale } from '@peertube/peertube-core-utils'
import {
  ActorImage,
  UserNewFeatureInfoRead,
  UserNewFeatureInfoType,
  User as UserServerModel,
  UserUpdateMe,
  UserVideoQuota
} from '@peertube/peertube-models'
import { from, Observable, of } from 'rxjs'
import { catchError, concatMap, first, map, shareReplay, toArray } from 'rxjs/operators'
import { environment } from '../../../environments/environment'
import { RestExtractor } from '../rest'
import { UserLocalStorageService } from './user-local-storage.service'
import { User } from './user.model'

@Injectable()
export class UserService {
  private authHttp = inject(HttpClient)
  private authService = inject(AuthService)
  private restExtractor = inject(RestExtractor)
  private localeId = inject(LOCALE_ID)
  private userLocalStorageService = inject(UserLocalStorageService)

  static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'
  static BASE_CLIENT_CONFIG_URL = environment.apiUrl + '/api/v1/client-config/'

  private userCache: { [id: number]: Observable<UserServerModel> } = {}
  private signupInThisSession = false

  // ---------------------------------------------------------------------------

  getUserWithCache (userId: number) {
    if (!this.userCache[userId]) {
      this.userCache[userId] = this.getUser(userId).pipe(shareReplay())
    }

    return this.userCache[userId]
  }

  getUser (userId: number, withStats = false) {
    const params = new HttpParams().append('withStats', withStats + '')

    return this.authHttp.get<UserServerModel>(UserService.BASE_USERS_URL + userId, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  setSignupInThisSession (value: boolean) {
    this.signupInThisSession = value
  }

  hasSignupInThisSession () {
    return this.signupInThisSession
  }

  // ---------------------------------------------------------------------------

  updateMyAnonymousProfile (profile: UserUpdateMe) {
    this.userLocalStorageService.setUserInfo(profile)
  }

  listenAnonymousUpdate () {
    return this.userLocalStorageService.listenUserInfoChange()
      .pipe(map(() => this.getAnonymousUser()))
  }

  getAnonymousUser () {
    return new User({
      ...this.userLocalStorageService.getUserInfo(),

      language: getCompleteLocale(this.localeId)
    })
  }

  getAnonymousOrLoggedUser () {
    if (!this.authService.isLoggedIn()) {
      return of(this.getAnonymousUser())
    }

    return this.authService.userInformationLoaded
      .pipe(
        first(),
        map(() => this.authService.getUser())
      )
  }

  // ---------------------------------------------------------------------------

  changePassword (currentPassword: string, newPassword: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      currentPassword,
      password: newPassword
    }

    return this.authHttp.put(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  changeEmail (password: string, newEmail: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      currentPassword: password,
      email: newEmail
    }

    return this.authHttp.put(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  askSendVerifyEmail (emailArg: string | string[]) {
    const emails = arrayify(emailArg)
    const url = UserService.BASE_USERS_URL + 'ask-send-verify-email'

    return from(emails)
      .pipe(
        concatMap(email => this.authHttp.post(url, { email })),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

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

  // ---------------------------------------------------------------------------

  updateMyProfile (profile: UserUpdateMe) {
    const url = UserService.BASE_USERS_URL + 'me'

    return this.authHttp.put(url, profile)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteMe () {
    const url = UserService.BASE_USERS_URL + 'me'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  changeAvatar (avatarForm: FormData) {
    const url = UserService.BASE_USERS_URL + 'me/avatar/pick'

    return this.authHttp.post<{ avatars: ActorImage[] }>(url, avatarForm)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteAvatar () {
    const url = UserService.BASE_USERS_URL + 'me/avatar'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getMyVideoQuotaUsed () {
    const url = UserService.BASE_USERS_URL + 'me/video-quota-used'

    return this.authHttp.get<UserVideoQuota>(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  askResetPassword (email: string) {
    const url = UserService.BASE_USERS_URL + '/ask-reset-password'

    return this.authHttp.post(url, { email })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  resetPassword (userId: number, verificationString: string, password: string) {
    const url = `${UserService.BASE_USERS_URL}/${userId}/reset-password`
    const body = {
      verificationString,
      password
    }

    return this.authHttp.post(url, body)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  autocomplete (search: string): Observable<string[]> {
    const url = UserService.BASE_USERS_URL + 'autocomplete'
    const params = new HttpParams().append('search', search)

    return this.authHttp
      .get<string[]>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateInterfaceLanguage (language: string) {
    const url = UserService.BASE_CLIENT_CONFIG_URL + 'update-interface-language'
    const body = { language }

    return this.authHttp.post(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  markNewFeatureInfoAsRead (feature: UserNewFeatureInfoType) {
    const url = UserService.BASE_USERS_URL + 'me/new-feature-info/read'
    const body: UserNewFeatureInfoRead = { feature }

    return this.authHttp.post(url, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
