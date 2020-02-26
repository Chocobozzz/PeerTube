import { from, Observable } from 'rxjs'
import { catchError, concatMap, map, shareReplay, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ResultList, User as UserServerModel, UserCreate, UserRole, UserUpdate, UserUpdateMe, UserVideoQuota } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../rest'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { SortMeta } from 'primeng/api'
import { BytesPipe } from 'ngx-pipes'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserRegister } from '@shared/models/users/user-register.model'
import { User } from './user.model'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'
import { has } from 'lodash-es'
import { LocalStorageService, SessionStorageService } from '../misc/storage.service'

@Injectable()
export class UserService {
  static BASE_USERS_URL = environment.apiUrl + '/api/v1/users/'

  private bytesPipe = new BytesPipe()

  private userCache: { [ id: number ]: Observable<UserServerModel> } = {}

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private localStorageService: LocalStorageService,
    private sessionStorageService: SessionStorageService,
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

  changeEmail (password: string, newEmail: string) {
    const url = UserService.BASE_USERS_URL + 'me'
    const body: UserUpdateMe = {
      currentPassword: password,
      email: newEmail
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

  updateMyAnonymousProfile (profile: UserUpdateMe) {
    const supportedKeys = {
      // local storage keys
      nsfwPolicy: (val: NSFWPolicyType) => this.localStorageService.setItem(User.KEYS.NSFW_POLICY, val),
      webTorrentEnabled: (val: boolean) => this.localStorageService.setItem(User.KEYS.WEBTORRENT_ENABLED, String(val)),
      autoPlayVideo: (val: boolean) => this.localStorageService.setItem(User.KEYS.AUTO_PLAY_VIDEO, String(val)),
      autoPlayNextVideoPlaylist: (val: boolean) => this.localStorageService.setItem(User.KEYS.AUTO_PLAY_VIDEO_PLAYLIST, String(val)),
      theme: (val: string) => this.localStorageService.setItem(User.KEYS.THEME, val),
      videoLanguages: (val: string[]) => this.localStorageService.setItem(User.KEYS.VIDEO_LANGUAGES, JSON.stringify(val)),

      // session storage keys
      autoPlayNextVideo: (val: boolean) =>
        this.sessionStorageService.setItem(User.KEYS.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO, String(val))
    }

    for (const key of Object.keys(profile)) {
      try {
        if (has(supportedKeys, key)) supportedKeys[key](profile[key])
      } catch (err) {
        console.error(`Cannot set item ${key} in localStorage. Likely due to a value impossible to stringify.`, err)
      }
    }
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

  signup (userCreate: UserRegister) {
    return this.authHttp.post(UserService.BASE_USERS_URL + 'register', userCreate)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getMyVideoQuotaUsed () {
    const url = UserService.BASE_USERS_URL + 'me/video-quota-used'

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

  verifyEmail (userId: number, verificationString: string, isPendingEmail: boolean) {
    const url = `${UserService.BASE_USERS_URL}/${userId}/verify-email`
    const body = {
      verificationString,
      isPendingEmail
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

  getNewUsername (oldDisplayName: string, newDisplayName: string, currentUsername: string) {
    // Don't update display name, the user seems to have changed it
    if (this.displayNameToUsername(oldDisplayName) !== currentUsername) return currentUsername

    return this.displayNameToUsername(newDisplayName)
  }

  displayNameToUsername (displayName: string) {
    if (!displayName) return ''

    return displayName
      .toLowerCase()
      .replace(/\s/g, '_')
      .replace(/[^a-z0-9_.]/g, '')
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

  updateUsers (users: UserServerModel[], userUpdate: UserUpdate) {
    return from(users)
      .pipe(
        concatMap(u => this.authHttp.put(UserService.BASE_USERS_URL + u.id, userUpdate)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  getUserWithCache (userId: number) {
    if (!this.userCache[userId]) {
      this.userCache[ userId ] = this.getUser(userId).pipe(shareReplay())
    }

    return this.userCache[userId]
  }

  getUser (userId: number) {
    return this.authHttp.get<UserServerModel>(UserService.BASE_USERS_URL + userId)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getAnonymousUser () {
    let videoLanguages
    try {
      videoLanguages = JSON.parse(this.localStorageService.getItem(User.KEYS.VIDEO_LANGUAGES))
    } catch (err) {
      videoLanguages = null
      console.error('Cannot parse desired video languages from localStorage.', err)
    }

    return new User({
      // local storage keys
      nsfwPolicy: this.localStorageService.getItem(User.KEYS.NSFW_POLICY) as NSFWPolicyType,
      webTorrentEnabled: this.localStorageService.getItem(User.KEYS.WEBTORRENT_ENABLED) !== 'false',
      autoPlayVideo: this.localStorageService.getItem(User.KEYS.AUTO_PLAY_VIDEO) === 'true',
      autoPlayNextVideoPlaylist: this.localStorageService.getItem(User.KEYS.AUTO_PLAY_VIDEO_PLAYLIST) === 'true',
      theme: this.localStorageService.getItem(User.KEYS.THEME) || 'default',
      videoLanguages,

      // session storage keys
      autoPlayNextVideo: this.sessionStorageService.getItem(User.KEYS.SESSION_STORAGE_AUTO_PLAY_NEXT_VIDEO) === 'true'
    })
  }

  getUsers (pagination: RestPagination, sort: SortMeta, search?: string): Observable<ResultList<UserServerModel>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)

    return this.authHttp.get<ResultList<UserServerModel>>(UserService.BASE_USERS_URL, { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 map(res => this.restExtractor.applyToResultListData(res, this.formatUser.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeUser (usersArg: UserServerModel | UserServerModel[]) {
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.delete(UserService.BASE_USERS_URL + u.id)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  banUsers (usersArg: UserServerModel | UserServerModel[], reason?: string) {
    const body = reason ? { reason } : {}
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.post(UserService.BASE_USERS_URL + u.id + '/block', body)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  unbanUsers (usersArg: UserServerModel | UserServerModel[]) {
    const users = Array.isArray(usersArg) ? usersArg : [ usersArg ]

    return from(users)
      .pipe(
        concatMap(u => this.authHttp.post(UserService.BASE_USERS_URL + u.id + '/unblock', {})),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  private formatUser (user: UserServerModel) {
    let videoQuota
    if (user.videoQuota === -1) {
      videoQuota = this.i18n('Unlimited')
    } else {
      videoQuota = this.bytesPipe.transform(user.videoQuota, 0)
    }

    const videoQuotaUsed = this.bytesPipe.transform(user.videoQuotaUsed, 0)

    const roleLabels: { [ id in UserRole ]: string } = {
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
