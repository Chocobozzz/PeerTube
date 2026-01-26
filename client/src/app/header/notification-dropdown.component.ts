import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router'
import { Notifier, PeerTubeSocket, ScreenService } from '@app/core'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { LoaderComponent } from '@app/shared/shared-main/common/loader.component'
import { UserNotificationService } from '@app/shared/shared-main/users/user-notification.service'
import { UserNotificationsComponent } from '@app/shared/shared-notifications/user-notifications.component'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { Subject, Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'

@Component({
  selector: 'my-notification-dropdown',
  templateUrl: './notification-dropdown.component.html',
  styleUrls: [ './notification-dropdown.component.scss' ],
  imports: [
    CommonModule,
    UserNotificationsComponent,
    GlobalIconComponent,
    LoaderComponent,
    RouterLink,
    RouterLinkActive,
    NgbDropdownModule,
    ButtonComponent
  ]
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  private userNotificationService = inject(UserNotificationService)
  private screenService = inject(ScreenService)
  private peertubeSocket = inject(PeerTubeSocket)
  private notifier = inject(Notifier)
  private router = inject(Router)

  readonly dropdown = viewChild<NgbDropdown>('dropdown')

  unreadNotifications = 0
  loaded = false
  opened = false

  markAllAsReadSubject = new Subject<boolean>()
  userNotificationReload = new Subject<boolean>()

  private notificationSub: Subscription
  private routeSub: Subscription

  ngOnInit () {
    this.userNotificationService.countUnreadNotifications()
      .subscribe({
        next: result => {
          this.unreadNotifications = result
          this.subscribeToNotifications()
        },

        error: err => this.notifier.handleError(err)
      })

    this.routeSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeDropdown())
  }

  ngOnDestroy () {
    if (this.notificationSub) this.notificationSub.unsubscribe()
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  get isInMobileView () {
    return this.screenService.isInMobileView()
  }

  closeDropdown () {
    const dropdown = this.dropdown()
    if (dropdown) dropdown.close()
  }

  onDropdownShown () {
    if (this.loaded) this.userNotificationReload.next(true)

    this.opened = true
  }

  onDropdownHidden () {
    this.opened = false
  }

  onNotificationLoaded () {
    this.loaded = true
  }

  onNavigate (link: HTMLAnchorElement) {
    this.closeDropdown()
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
