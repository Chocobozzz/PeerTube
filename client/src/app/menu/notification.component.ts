import { CommonModule } from '@angular/common'
import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router'
import { Notifier, PeerTubeSocket, ScreenService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { LoaderComponent } from '@app/shared/shared-main/loaders/loader.component'
import { UserNotificationService } from '@app/shared/shared-main/users/user-notification.service'
import { UserNotificationsComponent } from '@app/shared/standalone-notifications/user-notifications.component'
import { NgbPopover, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap'
import { Subject, Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'

@Component({
  selector: 'my-notification',
  templateUrl: './notification.component.html',
  styleUrls: [ './notification.component.scss' ],
  standalone: true,
  imports: [
    CommonModule,
    NgbPopoverModule,
    UserNotificationsComponent,
    GlobalIconComponent,
    LoaderComponent,
    RouterLink,
    RouterLinkActive
  ]
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
        .subscribe({
          next: result => {
            this.unreadNotifications = result
            this.subscribeToNotifications()
          },

          error: err => this.notifier.error(err.message)
        })

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

    document.querySelector('nav').scrollTo(0, 0) // Reset menu scroll to easy lock
    // eslint-disable-next-line @typescript-eslint/unbound-method
    document.querySelector('nav').addEventListener('scroll', this.onMenuScrollEvent)
  }

  onPopoverHidden () {
    this.loaded = false
    this.opened = false

    // eslint-disable-next-line @typescript-eslint/unbound-method
    document.querySelector('nav').removeEventListener('scroll', this.onMenuScrollEvent)
  }

  // Lock menu scroll when menu scroll to avoid fleeing / detached dropdown
  onMenuScrollEvent () {
    document.querySelector('nav').scrollTo(0, 0)
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
