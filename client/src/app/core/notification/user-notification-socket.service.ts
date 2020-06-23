import { Subject } from 'rxjs'
import { Injectable, NgZone } from '@angular/core'
import { UserNotification as UserNotificationServer } from '@shared/models'
import { environment } from '../../../environments/environment'
import { AuthService } from '../auth'

export type NotificationEvent = 'new' | 'read' | 'read-all'

@Injectable()
export class UserNotificationSocket {
  private notificationSubject = new Subject<{ type: NotificationEvent, notification?: UserNotificationServer }>()

  private socket: SocketIOClient.Socket

  constructor (
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  dispatch (type: NotificationEvent, notification?: UserNotificationServer) {
    this.notificationSubject.next({ type, notification })
  }

  async getMyNotificationsSocket () {
    await this.initSocket()

    return this.notificationSubject.asObservable()
  }

  private async initSocket () {
    if (this.socket) return

    // FIXME: import('..') returns a struct module, containing a "default" field corresponding to our sanitizeHtml function
    const io: typeof import ('socket.io-client') = (await import('socket.io-client') as any).default

    this.ngZone.runOutsideAngular(() => {
      this.socket = io(environment.apiUrl + '/user-notifications', {
        query: { accessToken: this.auth.getAccessToken() }
      })

      this.socket.on('new-notification', (n: UserNotificationServer) => this.dispatch('new', n))
    })
  }
}
