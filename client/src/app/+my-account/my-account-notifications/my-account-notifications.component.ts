import { Component, ViewChild } from '@angular/core'
import { UserNotificationsComponent } from '@app/shared'

@Component({
  templateUrl: './my-account-notifications.component.html',
  styleUrls: [ './my-account-notifications.component.scss' ]
})
export class MyAccountNotificationsComponent {
  @ViewChild('userNotification') userNotification: UserNotificationsComponent

  markAllAsRead () {
    this.userNotification.markAllAsRead()
  }
}
