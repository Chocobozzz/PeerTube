import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService, User, UserNotificationSocket } from '@app/core'
import { ResultList, UserNotification as UserNotificationServer, UserNotificationSetting } from '@shared/models'
import { environment } from '../../../../environments/environment'
import { UserNotification } from './user-notification.model'

@Injectable()
export class UserNotificationService {
  static BASE_NOTIFICATIONS_URL = environment.apiUrl + '/api/v1/users/me/notifications'
  static BASE_NOTIFICATION_SETTINGS = environment.apiUrl + '/api/v1/users/me/notification-settings'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private userNotificationSocket: UserNotificationSocket
  ) {}

  listMyNotifications (pagination: ComponentPaginationLight, unread?: boolean, ignoreLoadingBar = false) {
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

  markAsRead (notification: UserNotification) {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read'

    const body = { ids: [ notification.id ] }
    const headers = { ignoreLoadingBar: '' }

    return this.authHttp.post(url, body, { headers })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => this.userNotificationSocket.dispatch('read')),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  markAllAsRead () {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read-all'
    const headers = { ignoreLoadingBar: '' }

    return this.authHttp.post(url, {}, { headers })
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => this.userNotificationSocket.dispatch('read-all')),
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

  private formatNotification (notification: UserNotificationServer) {
    return new UserNotification(notification)
  }
}
