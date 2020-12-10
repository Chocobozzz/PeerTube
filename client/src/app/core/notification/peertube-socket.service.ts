import { Subject } from 'rxjs'
import { Injectable, NgZone } from '@angular/core'
import { LiveVideoEventPayload, LiveVideoEventType, UserNotification as UserNotificationServer } from '@shared/models'
import { environment } from '../../../environments/environment'
import { AuthService } from '../auth'
import { io, Socket } from 'socket.io-client'

export type NotificationEvent = 'new' | 'read' | 'read-all'

@Injectable()
export class PeerTubeSocket {
  private io: typeof io

  private notificationSubject = new Subject<{ type: NotificationEvent, notification?: UserNotificationServer }>()
  private liveVideosSubject = new Subject<{ type: LiveVideoEventType, payload: LiveVideoEventPayload }>()

  private notificationSocket: Socket
  private liveVideosSocket: Socket

  constructor (
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  async getMyNotificationsSocket () {
    await this.initNotificationSocket()

    return this.notificationSubject.asObservable()
  }

  getLiveVideosObservable () {
    return this.liveVideosSubject.asObservable()
  }

  async subscribeToLiveVideosSocket (videoId: number) {
    await this.initLiveVideosSocket()

    this.liveVideosSocket.emit('subscribe', { videoId })
  }

  async unsubscribeLiveVideos (videoId: number) {
    if (!this.liveVideosSocket) return

    this.liveVideosSocket.emit('unsubscribe', { videoId })
  }

  dispatchNotificationEvent (type: NotificationEvent, notification?: UserNotificationServer) {
    this.notificationSubject.next({ type, notification })
  }

  private async initNotificationSocket () {
    if (this.notificationSocket) return

    await this.importIOIfNeeded()

    // Prevent protractor issues https://github.com/angular/angular/issues/11853
    this.ngZone.runOutsideAngular(() => {
      this.notificationSocket = this.io(environment.apiUrl + '/user-notifications', {
        query: { accessToken: this.auth.getAccessToken() }
      })

      this.notificationSocket.on('new-notification', (n: UserNotificationServer) => {
        this.ngZone.run(() => this.dispatchNotificationEvent('new', n))
      })
    })

  }

  private async initLiveVideosSocket () {
    if (this.liveVideosSocket) return

    await this.importIOIfNeeded()

    // Prevent protractor issues https://github.com/angular/angular/issues/11853
    this.ngZone.runOutsideAngular(() => {
      this.liveVideosSocket = this.io(environment.apiUrl + '/live-videos')
    })

    const types: LiveVideoEventType[] = [ 'views-change', 'state-change' ]

    for (const type of types) {
      this.liveVideosSocket.on(type, (payload: LiveVideoEventPayload) => {
        this.ngZone.run(() => this.dispatchLiveVideoEvent(type, payload))
      })
    }
  }

  private async importIOIfNeeded () {
    if (this.io) return

    this.io = (await import('socket.io-client')).io
  }

  private dispatchLiveVideoEvent (type: LiveVideoEventType, payload: LiveVideoEventPayload) {
    this.liveVideosSubject.next({ type, payload })
  }
}
