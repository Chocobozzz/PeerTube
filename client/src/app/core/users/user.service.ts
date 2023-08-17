import { Observable, of } from 'rxjs'
import { catchError, first, map, shareReplay } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AuthService } from '@app/core/auth'
import { ActorImage, User as UserServerModel, UserUpdateMe, UserVideoQuota } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { RestExtractor } from '../rest'
import { UserLocalStorageService } from './user-local-storage.service'
import { User } from './user.model'

@Injectable()
export class UserService {
  static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'

  private userCache: { [ id: number ]: Observable<UserServerModel> } = {}
  private signupInThisSession = false

  constructor (
    private authHttp: HttpClient,
    private authService: AuthService,
    private restExtractor: RestExtractor,
    private userLocalStorageService: UserLocalStorageService
  ) { }

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
    return new User(this.userLocalStorageService.getUserInfo())
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

  changeEmail (password: string, newEmail: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      currentPassword: password,
      email: newEmail
    }

    return this.authHttp.put(url, body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

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
}
