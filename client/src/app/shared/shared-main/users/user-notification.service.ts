import { SortMeta } from 'primeng/api'
import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { AuthService, ComponentPaginationLight, PeerTubeSocket, RestExtractor, RestService } from '@app/core'
import { NGX_LOADING_BAR_IGNORED } from '@ngx-loading-bar/http-client'
import { ResultList, UserNotification as UserNotificationServer, UserNotificationSetting } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'
import { UserNotification } from './user-notification.model'

@Injectable()
export class UserNotificationService {
  private authHttp = inject(HttpClient)
  private auth = inject(AuthService)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)
  private peertubeSocket = inject(PeerTubeSocket)

  static BASE_NOTIFICATIONS_URL = environment.apiUrl + '/api/v1/users/me/notifications'
  static BASE_NOTIFICATION_SETTINGS = environment.apiUrl + '/api/v1/users/me/notification-settings'

  listMyNotifications (parameters: {
    pagination: ComponentPaginationLight
    ignoreLoadingBar?: boolean
    unread?: boolean
    sort?: SortMeta
  }) {
    const { pagination, ignoreLoadingBar, unread, sort } = parameters

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, this.restService.componentToRestPagination(pagination), sort)

    if (unread) params = params.append('unread', `${unread}`)

    const context = ignoreLoadingBar
      ? new HttpContext().set(NGX_LOADING_BAR_IGNORED, true)
      : undefined

    return this.authHttp.get<ResultList<UserNotificationServer>>(UserNotificationService.BASE_NOTIFICATIONS_URL, { params, context })
      .pipe(
        map(res => this.restExtractor.applyToResultListData(res, this.formatNotification.bind(this))),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  countUnreadNotifications () {
    return this.listMyNotifications({ pagination: { currentPage: 1, itemsPerPage: 0 }, ignoreLoadingBar: true, unread: true })
      .pipe(
        map(n => n.total),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  markAsRead (notification: UserNotification) {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read'

    const body = { ids: [ notification.payload.id ] }
    const context = new HttpContext().set(NGX_LOADING_BAR_IGNORED, true)

    return this.authHttp.post(url, body, { context })
      .pipe(
        tap(() => this.peertubeSocket.dispatchNotificationEvent('read')),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  markAllAsRead () {
    const url = UserNotificationService.BASE_NOTIFICATIONS_URL + '/read-all'
    const context = new HttpContext().set(NGX_LOADING_BAR_IGNORED, true)

    return this.authHttp.post(url, {}, { context })
      .pipe(
        tap(() => this.peertubeSocket.dispatchNotificationEvent('read-all')),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  updateNotificationSettings (settings: UserNotificationSetting) {
    const url = UserNotificationService.BASE_NOTIFICATION_SETTINGS

    return this.authHttp.put(url, settings)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  private formatNotification (notification: UserNotificationServer) {
    return new UserNotification(notification, this.auth.getUser())
  }
}
