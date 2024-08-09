import { Subject } from 'rxjs'
import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client'
import { Injectable } from '@angular/core'
import { LiveVideoEventPayload, LiveVideoEventType, UserNotification as UserNotificationServer } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { AuthService } from '../auth'

export type NotificationEvent = 'new' | 'read' | 'read-all'

@Injectable()
export class PeerTubeSocket {
  private io: (uri: string, opts?: Partial<ManagerOptions & SocketOptions>) => Socket

  private notificationSubject = new Subject<{ type: NotificationEvent, notification?: UserNotificationServer }>()
  private liveVideosSubject = new Subject<{ type: LiveVideoEventType, payload: LiveVideoEventPayload }>()

  private notificationSocket: Socket
  private liveVideosSocket: Socket

  constructor (
    private auth: AuthService
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

  unsubscribeLiveVideos (videoId: number) {
    if (!this.liveVideosSocket) return

    this.liveVideosSocket.emit('unsubscribe', { videoId })
  }

  dispatchNotificationEvent (type: NotificationEvent, notification?: UserNotificationServer) {
    this.notificationSubject.next({ type, notification })
  }

  private async initNotificationSocket () {
    if (this.notificationSocket) return

    await this.importIOIfNeeded()

    this.notificationSocket = this.io(environment.apiUrl + '/user-notifications', {
      query: { accessToken: this.auth.getAccessToken() }
    })

    this.notificationSocket.on('new-notification', (n: UserNotificationServer) => {
      this.dispatchNotificationEvent('new', n)
    })
  }

  private async initLiveVideosSocket () {
    if (this.liveVideosSocket) return

    await this.importIOIfNeeded()

    this.liveVideosSocket = this.io(environment.apiUrl + '/live-videos')

    const types: LiveVideoEventType[] = [ 'views-change', 'state-change', 'force-end' ]

    for (const type of types) {
      this.liveVideosSocket.on(type, (payload: LiveVideoEventPayload) => {
        this.dispatchLiveVideoEvent(type, payload)
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
