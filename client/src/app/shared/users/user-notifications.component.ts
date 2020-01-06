import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { UserNotificationService } from '@app/shared/users/user-notification.service'
import { UserNotificationType } from '../../../../../shared'
import { ComponentPagination, hasMoreItems } from '@app/shared/rest/component-pagination.model'
import { Notifier } from '@app/core'
import { UserNotification } from '@app/shared/users/user-notification.model'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-user-notifications',
  templateUrl: 'user-notifications.component.html',
  styleUrls: [ 'user-notifications.component.scss' ]
})
export class UserNotificationsComponent implements OnInit {
  @Input() ignoreLoadingBar = false
  @Input() infiniteScroll = true
  @Input() itemsPerPage = 20
  @Input() markAllAsReadSubject: Subject<boolean>

  @Output() notificationsLoaded = new EventEmitter()

  notifications: UserNotification[] = []

  // So we can access it in the template
  UserNotificationType = UserNotificationType

  componentPagination: ComponentPagination

  onDataSubject = new Subject<any[]>()

  constructor (
    private userNotificationService: UserNotificationService,
    private notifier: Notifier
  ) { }

  ngOnInit () {
    this.componentPagination = {
      currentPage: 1,
      itemsPerPage: this.itemsPerPage, // Reset items per page, because of the @Input() variable
      totalItems: null
    }

    this.loadMoreNotifications()

    if (this.markAllAsReadSubject) {
      this.markAllAsReadSubject.subscribe(() => this.markAllAsRead())
    }
  }

  loadMoreNotifications () {
    this.userNotificationService.listMyNotifications(this.componentPagination, undefined, this.ignoreLoadingBar)
        .subscribe(
          result => {
            this.notifications = this.notifications.concat(result.data)
            this.componentPagination.totalItems = result.total

            this.notificationsLoaded.emit()

            this.onDataSubject.next(result.data)
          },

          err => this.notifier.error(err.message)
        )
  }

  onNearOfBottom () {
    if (this.infiniteScroll === false) return

    this.componentPagination.currentPage++

    if (hasMoreItems(this.componentPagination)) {
      this.loadMoreNotifications()
    }
  }

  markAsRead (notification: UserNotification) {
    if (notification.read) return

    this.userNotificationService.markAsRead(notification)
        .subscribe(
          () => {
            notification.read = true
          },

          err => this.notifier.error(err.message)
        )
  }

  markAllAsRead () {
    this.userNotificationService.markAllAsRead()
        .subscribe(
          () => {
            for (const notification of this.notifications) {
              notification.read = true
            }
          },

          err => this.notifier.error(err.message)
        )
  }
}
