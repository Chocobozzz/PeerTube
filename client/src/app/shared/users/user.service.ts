import { from, Observable } from 'rxjs'
import { catchError, concatMap, map, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ResultList, User, UserCreate, UserRole, UserUpdate, UserUpdateMe, UserVideoQuota } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { SortMeta } from 'primeng/api'
import { BytesPipe } from 'ngx-pipes'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Injectable()
export class UserService {
  static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'

  private bytesPipe = new BytesPipe()

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private i18n: I18n
  ) { }

  changePassword (currentPassword: string, newPassword: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      currentPassword,
      password: newPassword
    }

    return this.authHttp.put(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateMyProfile (profile: UserUpdateMe) {
    const url = UserService.BASE_USERS_URL + 'me'

    return this.authHttp.put(url, profile)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  deleteMe () {
    const url = UserService.BASE_USERS_URL + 'me'

    return this.authHttp.delete(url)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  changeAvatar (avatarForm: FormData) {
    const url = UserService.BASE_USERS_URL + 'me/avatar/pick'

    return this.authHttp.post<{ avatar: Avatar }>(url, avatarForm)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  signup (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL + 'register', userCreate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getMyVideoQuotaUsed () {
    const url = UserService.BASE_USERS_URL + '/me/video-quota-used'

    return this.authHttp.get<UserVideoQuota>(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  askResetPassword (email: string) {
    const url = UserService.BASE_USERS_URL + '/ask-reset-password'

    return this.authHttp.post(url, { email })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  resetPassword (userId: number, verificationString: string, password: string) {
    const url = `${UserService.BASE_USERS_URL}/${userId}/reset-password`
    const body = {
      verificationString,
      password
    }

    return this.authHttp.post(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  verifyEmail (userId: number, verificationString: string) {
    const url = `${UserService.BASE_USERS_URL}/${userId}/verify-email`
    const body = {
      verificationString
    }

    return this.authHttp.post(url, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  askSendVerifyEmail (email: string) {
    const url = UserService.BASE_USERS_URL + '/ask-send-verify-email'

    return this.authHttp.post(url, { email })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  autocomplete (search: string): Observable<string[]> {
    const url = UserService.BASE_USERS_URL + 'autocomplete'
    const params = new HttpParams().append('search', search)

    return this.authHttp
      .get<string[]>(url, { params })
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  /* ###### Admin methods ###### */

  addUser (userCreate: UserCreate) {
    return this.authHttp.post(UserService.BASE_USERS_URL, userCreate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateUser (userId: number, userUpdate: UserUpdate) {
    return this.authHttp.put(UserService.BASE_USERS_URL + userId, userUpdate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getUser (userId: number) {
    return this.authHttp.get<User>(UserService.BASE_USERS_URL + userId)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getUsers (pagination: RestPagination, sort: SortMeta, search?: string): Observable<ResultList<User>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)

    return this.authHttp.get<ResultList<User>>(UserService.BASE_USERS_URL, { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 map(res => this.restExtractor.applyToResultListData(res, this.formatUser.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeUser (usersArg: User | User[]) {
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.delete(UserService.BASE_USERS_URL + u.id)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  banUsers (usersArg: User | User[], reason?: string) {
    const body = reason ? { reason } : {}
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.post(UserService.BASE_USERS_URL + u.id + '/block', body)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  unbanUsers (usersArg: User | User[]) {
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.post(UserService.BASE_USERS_URL + u.id + '/unblock', {})),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  private formatUser (user: User) {
    let videoQuota
    if (user.videoQuota === -1) {
      videoQuota = this.i18n('Unlimited')
    } else {
      videoQuota = this.bytesPipe.transform(user.videoQuota, 0)
    }

    const videoQuotaUsed = this.bytesPipe.transform(user.videoQuotaUsed, 0)

    const roleLabels: { [ id in UserRole ]: string } = {
      [UserRole.VALIDATOR]: this.i18n('Validator'),
      [UserRole.USER]: this.i18n('User'),
      [UserRole.ADMINISTRATOR]: this.i18n('Administrator'),
      [UserRole.MODERATOR]: this.i18n('Moderator')
    }

    return Object.assign(user, {
      roleLabel: roleLabels[user.role],
      videoQuota,
      videoQuotaUsed
    })
  }
}
