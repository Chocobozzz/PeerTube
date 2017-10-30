import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { Observable } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject'
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import 'rxjs/add/operator/do'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mergeMap'
import 'rxjs/add/observable/throw'

import { NotificationsService } from 'angular2-notifications'

import { AuthStatus } from './auth-status.model'
import { AuthUser } from './auth-user.model'
import {
  OAuthClientLocal,
  UserRole,
  UserRefreshToken,
  VideoChannel,
  User as UserServerModel
} from '../../../../../shared'
// Do not use the barrel (dependency loop)
import { RestExtractor } from '../../shared/rest'
import { UserLogin } from '../../../../../shared/models/users/user-login.model'
import { UserConstructorHash } from '../../shared/users/user.model'

interface UserLoginWithUsername extends UserLogin {
  access_token: string
  refresh_token: string
  token_type: string
  username: string
}

interface UserLoginWithUserInformation extends UserLogin {
  access_token: string
  refresh_token: string
  token_type: string
  username: string
  id: number
  role: UserRole
  displayNSFW: boolean
  email: string
  videoQuota: number
  author: {
    id: number
    uuid: string
  }
  videoChannels: VideoChannel[]
}

@Injectable()
export class AuthService {
  private static BASE_CLIENT_URL = API_URL + '/api/v1/oauth-clients/local'
  private static BASE_TOKEN_URL = API_URL + '/api/v1/users/token'
  private static BASE_USER_INFORMATION_URL = API_URL + '/api/v1/users/me'

  loginChangedSource: Observable<AuthStatus>
  userInformationLoaded = new ReplaySubject<boolean>(1)

  private clientId: string
  private clientSecret: string
  private loginChanged: Subject<AuthStatus>
  private user: AuthUser = null

  constructor (
    private http: HttpClient,
    private notificationsService: NotificationsService,
    private restExtractor: RestExtractor,
    private router: Router
   ) {
    this.loginChanged = new Subject<AuthStatus>()
    this.loginChangedSource = this.loginChanged.asObservable()

    // Return null if there is nothing to load
    this.user = AuthUser.load()
  }

  loadClientCredentials () {
    // Fetch the client_id/client_secret
    // FIXME: save in local storage?
    this.http.get<OAuthClientLocal>(AuthService.BASE_CLIENT_URL)
             .catch(res => this.restExtractor.handleError(res))
             .subscribe(
               res => {
                 this.clientId = res.client_id
                 this.clientSecret = res.client_secret
                 console.log('Client credentials loaded.')
               },

               error => {
                 let errorMessage = `Cannot retrieve OAuth Client credentials: ${error.text}. \n`
                 errorMessage += 'Ensure you have correctly configured PeerTube (config/ directory), in particular the "webserver" section.'

                 // We put a bigger timeout
                 // This is an important message
                 this.notificationsService.error('Error', errorMessage, { timeOut: 7000 })
               }
             )
  }

  getRefreshToken () {
    if (this.user === null) return null

    return this.user.getRefreshToken()
  }

  getRequestHeaderValue () {
    const accessToken = this.getAccessToken()

    if (accessToken === null) return null

    return `${this.getTokenType()} ${accessToken}`
  }

  getAccessToken () {
    if (this.user === null) return null

    return this.user.getAccessToken()
  }

  getTokenType () {
    if (this.user === null) return null

    return this.user.getTokenType()
  }

  getUser () {
    return this.user
  }

  isLoggedIn () {
    return !!this.getAccessToken()
  }

  login (username: string, password: string) {
    // Form url encoded
    const body = new HttpParams().set('client_id', this.clientId)
                                 .set('client_secret', this.clientSecret)
                                 .set('response_type', 'code')
                                 .set('grant_type', 'password')
                                 .set('scope', 'upload')
                                 .set('username', username)
                                 .set('password', password)

    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded')

    return this.http.post<UserLogin>(AuthService.BASE_TOKEN_URL, body, { headers })
                    .map(res => Object.assign(res, { username }))
                    .flatMap(res => this.mergeUserInformation(res))
                    .map(res => this.handleLogin(res))
                    .catch(res => this.restExtractor.handleError(res))
  }

  logout () {
    // TODO: make an HTTP request to revoke the tokens
    this.user = null

    AuthUser.flush()

    this.setStatus(AuthStatus.LoggedOut)
  }

  refreshAccessToken () {
    console.log('Refreshing token...')

    const refreshToken = this.getRefreshToken()

    // Form url encoded
    const body = new HttpParams().set('refresh_token', refreshToken)
                                 .set('client_id', this.clientId)
                                 .set('client_secret', this.clientSecret)
                                 .set('response_type', 'code')
                                 .set('grant_type', 'refresh_token')

    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded')

    return this.http.post<UserRefreshToken>(AuthService.BASE_TOKEN_URL, body, { headers })
                    .map(res => this.handleRefreshToken(res))
                    .catch(res => {
                      // The refresh token is invalid?
                      if (res.status === 400 && res.error.error === 'invalid_grant') {
                        console.error('Cannot refresh token -> logout...')
                        this.logout()
                        this.router.navigate(['/login'])

                        return Observable.throw({
                          error: 'You need to reconnect.'
                        })
                      }

                      return this.restExtractor.handleError(res)
                    })
  }

  refreshUserInformation () {
    const obj = {
      access_token: this.user.getAccessToken(),
      refresh_token: null,
      token_type: this.user.getTokenType(),
      username: this.user.username
    }

    this.mergeUserInformation(obj)
      .do(() => this.userInformationLoaded.next(true))
      .subscribe(
        res => {
          this.user.displayNSFW = res.displayNSFW
          this.user.role = res.role
          this.user.videoChannels = res.videoChannels
          this.user.author = res.author

          this.user.save()
        }
      )
  }

  private mergeUserInformation (obj: UserLoginWithUsername): Observable<UserLoginWithUserInformation> {
    // User is not loaded yet, set manually auth header
    const headers = new HttpHeaders().set('Authorization', `${obj.token_type} ${obj.access_token}`)

    return this.http.get<UserServerModel>(AuthService.BASE_USER_INFORMATION_URL, { headers })
                    .map(res => {
                      const newProperties = {
                        id: res.id,
                        role: res.role,
                        displayNSFW: res.displayNSFW,
                        email: res.email,
                        videoQuota: res.videoQuota,
                        author: res.author,
                        videoChannels: res.videoChannels
                      }

                      return Object.assign(obj, newProperties)
                    }
    )
  }

  private handleLogin (obj: UserLoginWithUserInformation) {
    const hashUser: UserConstructorHash = {
      id: obj.id,
      username: obj.username,
      role: obj.role,
      email: obj.email,
      displayNSFW: obj.displayNSFW,
      videoQuota: obj.videoQuota,
      videoChannels: obj.videoChannels,
      author: obj.author
    }
    const hashTokens = {
      accessToken: obj.access_token,
      tokenType: obj.token_type,
      refreshToken: obj.refresh_token
    }

    this.user = new AuthUser(hashUser, hashTokens)
    this.user.save()

    this.setStatus(AuthStatus.LoggedIn)
  }

  private handleRefreshToken (obj: UserRefreshToken) {
    this.user.refreshTokens(obj.access_token, obj.refresh_token)
    this.user.save()
  }

  private setStatus (status: AuthStatus) {
    this.loginChanged.next(status)
  }
}
