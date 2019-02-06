import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { UserNotification as UserNotificationServer } from '../../../../../shared'
import { Subject } from 'rxjs'
import * as io from 'socket.io-client'
import { AuthService } from '../auth'

export type NotificationEvent = 'new' | 'read' | 'read-all'

@Injectable()
export class UserNotificationSocket {
  private notificationSubject = new Subject<{ type: NotificationEvent, notification?: UserNotificationServer }>()

  private socket: SocketIOClient.Socket

  constructor (
    private auth: AuthService
  ) {}

  dispatch (type: NotificationEvent, notification?: UserNotificationServer) {
    this.notificationSubject.next({ type, notification })
  }

  getMyNotificationsSocket () {
    const socket = this.getSocket()

    socket.on('new-notification', (n: UserNotificationServer) => this.dispatch('new', n))

    return this.notificationSubject.asObservable()
  }

  private getSocket () {
    if (this.socket) return this.socket

    this.socket = io(environment.apiUrl + '/user-notifications', {
      query: { accessToken: this.auth.getAccessToken() }
    })

    return this.socket
  }
}
