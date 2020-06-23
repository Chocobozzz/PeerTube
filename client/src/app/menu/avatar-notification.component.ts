import { Subject, Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { Notifier, User, UserNotificationSocket } from '@app/core'
import { UserNotificationService } from '@app/shared/shared-main'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-avatar-notification',
  templateUrl: './avatar-notification.component.html',
  styleUrls: [ './avatar-notification.component.scss' ]
})
export class AvatarNotificationComponent implements OnInit, OnDestroy {
  @ViewChild('popover', { static: true }) popover: NgbPopover

  @Input() user: User

  unreadNotifications = 0
  loaded = false

  markAllAsReadSubject = new Subject<boolean>()

  private notificationSub: Subscription
  private routeSub: Subscription

  constructor (
    private userNotificationService: UserNotificationService,
    private userNotificationSocket: UserNotificationSocket,
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

  closePopover () {
    this.popover.close()
  }

  onPopoverHidden () {
    this.loaded = false
  }

  onNotificationLoaded () {
    this.loaded = true
  }

  markAllAsRead () {
    this.markAllAsReadSubject.next(true)
  }

  private async subscribeToNotifications () {
    const obs = await this.userNotificationSocket.getMyNotificationsSocket()

    this.notificationSub = obs.subscribe(data => {
      if (data.type === 'new') return this.unreadNotifications++
      if (data.type === 'read') return this.unreadNotifications--
      if (data.type === 'read-all') return this.unreadNotifications = 0
    })
  }

}
