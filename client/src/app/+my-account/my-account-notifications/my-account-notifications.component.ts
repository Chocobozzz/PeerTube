import { Component, ViewChild } from '@angular/core'
import { UserNotificationsComponent } from '@app/shared/standalone-notifications/user-notifications.component'
import { NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { RouterLink } from '@angular/router'

type NotificationSortType = 'createdAt' | 'read'

@Component({
  templateUrl: './my-account-notifications.component.html',
  styleUrls: [ './my-account-notifications.component.scss' ],
  imports: [ RouterLink, GlobalIconComponent, FormsModule, NgIf, UserNotificationsComponent ]
})
export class MyAccountNotificationsComponent {
  @ViewChild('userNotification', { static: true }) userNotification: UserNotificationsComponent

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
    this.userNotification.markAllAsRead()
  }

  hasUnreadNotifications () {
    return this.userNotification.notifications.filter(n => n.read === false).length !== 0
  }

  onChangeSortColumn () {
    this.userNotification.changeSortColumn(this.notificationSortType)
  }
}
