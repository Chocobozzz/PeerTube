import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { RestExtractor, RestService } from '@app/shared/rest'
import { catchError, map, tap } from 'rxjs/operators'
import { environment } from '../../../environments/environment'
import { ResultList, UserNotification as UserNotificationServer, UserNotificationSetting } from '../../../../../shared'
import { UserNotification } from '@app/shared/users/user-notification.model'
import { Subject } from 'rxjs'
import * as io from 'socket.io-client'
import { AuthService } from '@app/core'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { User } from '@app/shared'

@Injectable()
export class UserNotificationService {
  static BASE_NOTIFICATIONS_URL = environment.apiUrl + '/api/v1/users/me/notifications'
  static BASE_NOTIFICATION_SETTINGS = environment.apiUrl + '/api/v1/users/me/notification-settings'

  private notificationSubject = new Subject<{ type: 'new' | 'read' | 'read-all', notification?: UserNotification }>()

  private socket: SocketIOClient.Socket

  constructor (
    private auth: AuthService,
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  listMyNotifications (pagination: ComponentPagination, unread?: boolean, ignoreLoadingBar = false) {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, this.restService.componentPaginationToRestPagination(pagination))

    if (unread) params = params.append('unread', `${unread}`)

    const headers = ignoreLoadingBar ? { ignoreLoadingBar: '' } : undefined

    return this.authHttp.get<ResultList<UserNotification>>(UserNotificationService.BASE_NOTIFICATIONS_URL, { params, headers })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 map(res => this.restExtractor.applyToResultListData(res, this.formatNotification.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  countUnreadNotifications () {
    return this.listMyNotifications({ currentPage: 1, itemsPerPage: 0 }, true)
      .pipe(map(n => n.total))
  }

  getMyNotificationsSocket () {
    const socket = this.getSocket()

    socket.on('new-notification', (n: UserNotificationServer) => {
      this.notificationSubject.next({ type: 'new', notification: new UserNotification(n) })
    })

    return this.notificationSubject.asObservable()
  }

  markAsRead (notification: UserNotification) {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read'

    const body = { ids: [ notification.id ] }
    const headers = { ignoreLoadingBar: '' }

    return this.authHttp.post(url, body, { headers })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => this.notificationSubject.next({ type: 'read' })),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  markAllAsRead () {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read-all'
    const headers = { ignoreLoadingBar: '' }

    return this.authHttp.post(url, {}, { headers })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => this.notificationSubject.next({ type: 'read-all' })),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  updateNotificationSettings (user: User, settings: UserNotificationSetting) {
    const url = UserNotificationService.BASE_NOTIFICATION_SETTINGS

    return this.authHttp.put(url, settings)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  private getSocket () {
    if (this.socket) return this.socket

    this.socket = io(environment.apiUrl + '/user-notifications', {
      query: { accessToken: this.auth.getAccessToken() }
    })

    return this.socket
  }

  private formatNotification (notification: UserNotificationServer) {
    return new UserNotification(notification)
  }
}
