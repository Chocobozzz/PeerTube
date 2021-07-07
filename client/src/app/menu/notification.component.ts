import { Subject, Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import { Component, EventEmitter, Output, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { Notifier, PeerTubeSocket, ScreenService } from '@app/core'
import { UserNotificationService } from '@app/shared/shared-main'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-notification',
  templateUrl: './notification.component.html',
  styleUrls: [ './notification.component.scss' ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  @ViewChild('popover', { static: true }) popover: NgbPopover

  @Output() navigate = new EventEmitter<HTMLAnchorElement>()

  unreadNotifications = 0
  loaded = false
  opened = false

  markAllAsReadSubject = new Subject<boolean>()

  private notificationSub: Subscription
  private routeSub: Subscription

  constructor (
    private userNotificationService: UserNotificationService,
    private screenService: ScreenService,
    private peertubeSocket: PeerTubeSocket,
    private notifier: Notifier,
    private router: Router
  ) {
  }

  ngOnInit () {
    this.userNotificationService.countUnreadNotifications()
        .subscribe(
          result => {
            this.unreadNotifications = Math.min(result, 99) // Limit number to 99
            this.subscribeToNotifications()
          },

          err => this.notifier.error(err.message)
        )

    this.routeSub = this.router.events
                        .pipe(filter(event => event instanceof NavigationEnd))
                        .subscribe(() => this.closePopover())
  }

  ngOnDestroy () {
    if (this.notificationSub) this.notificationSub.unsubscribe()
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  get isInMobileView () {
    return this.screenService.isInMobileView()
  }

  closePopover () {
    this.popover.close()
  }

  onPopoverShown () {
    this.opened = true

    document.querySelector('menu').scrollTo(0, 0) // Reset menu scroll to easy lock
    document.querySelector('menu').addEventListener('scroll', this.onMenuScrollEvent)
  }

  onPopoverHidden () {
    this.loaded = false
    this.opened = false

    document.querySelector('menu').removeEventListener('scroll', this.onMenuScrollEvent)
  }

  // Lock menu scroll when menu scroll to avoid fleeing / detached dropdown
  onMenuScrollEvent () {
    document.querySelector('menu').scrollTo(0, 0)
  }

  onNotificationLoaded () {
    this.loaded = true
  }

  onNavigate (link: HTMLAnchorElement) {
    this.closePopover()
    this.navigate.emit(link)
  }

  markAllAsRead () {
    this.markAllAsReadSubject.next(true)
  }

  private async subscribeToNotifications () {
    const obs = await this.peertubeSocket.getMyNotificationsSocket()

    this.notificationSub = obs.subscribe(data => {
      if (data.type === 'new') return this.unreadNotifications++
      if (data.type === 'read') return this.unreadNotifications--
      if (data.type === 'read-all') return this.unreadNotifications = 0
    })
  }
}
