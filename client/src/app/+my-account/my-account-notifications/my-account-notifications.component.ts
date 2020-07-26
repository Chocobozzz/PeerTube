import { Component, ViewChild } from '@angular/core'
import { UserNotificationsComponent } from '@app/shared/shared-main'

@Component({
  templateUrl: './my-account-notifications.component.html',
  styleUrls: [ './my-account-notifications.component.scss' ]
})
export class MyAccountNotificationsComponent {
  @ViewChild('userNotification', { static: true }) userNotification: UserNotificationsComponent

  notificationSortType = 'created'

  markAllAsRead () {
    this.userNotification.markAllAsRead()
  }

  hasUnreadNotifications () {
    return this.userNotification.notifications.filter(n => n.read === false).length !== 0
  }

  onNotificationSortTypeChanged () {}
}
