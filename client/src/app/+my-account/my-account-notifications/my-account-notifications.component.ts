import { CommonModule } from '@angular/common'
import { Component, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { UserNotificationsComponent } from '@app/shared/shared-notifications/user-notifications.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

type NotificationSortType = 'createdAt' | 'read'

@Component({
  templateUrl: './my-account-notifications.component.html',
  styleUrls: [ './my-account-notifications.component.scss' ],
  imports: [ CommonModule, RouterLink, GlobalIconComponent, FormsModule, UserNotificationsComponent ]
})
export class MyAccountNotificationsComponent {
  readonly userNotification = viewChild<UserNotificationsComponent>('userNotification')

  _notificationSortType: NotificationSortType = 'createdAt'

  get notificationSortType () {
    return !this.hasUnreadNotifications()
      ? 'createdAt'
      : this._notificationSortType
  }

  set notificationSortType (type: NotificationSortType) {
    this._notificationSortType = type
  }

  markAllAsRead () {
    this.userNotification().markAllAsRead()
  }

  hasUnreadNotifications () {
    return this.userNotification().notifications.filter(n => n.payload.read === false).length !== 0
  }

  onChangeSortColumn () {
    this.userNotification().changeSortColumn(this.notificationSortType)
  }
}
