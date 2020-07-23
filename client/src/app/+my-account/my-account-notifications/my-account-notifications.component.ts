import { Component, ViewChild } from '@angular/core'
import { UserNotificationsComponent } from '@app/shared/shared-main'

type NotificationSortType = 'createdAt' | 'read'

@Component({
  templateUrl: './my-account-notifications.component.html',
  styleUrls: [ './my-account-notifications.component.scss' ]
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
