import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, OnInit, output } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ComponentPagination, hasMoreItems, Notifier } from '@app/core'
import { Subject } from 'rxjs'
import { InfiniteScrollerDirective } from '../shared-main/common/infinite-scroller.directive'
import { DateGroupLabelComponent, GroupDate, GroupDateLabels } from '../shared-main/date/date-group-label.component'
import { UserNotification } from '../shared-main/users/user-notification.model'
import { UserNotificationService } from '../shared-main/users/user-notification.service'
import { UserNotificationContentComponent } from './user-notification-content.component'

@Component({
  selector: 'my-user-notifications',
  templateUrl: 'user-notifications.component.html',
  styleUrls: [ 'user-notifications.component.scss' ],
  imports: [
    CommonModule,
    RouterLink,
    InfiniteScrollerDirective,
    UserNotificationContentComponent,
    DateGroupLabelComponent
  ]
})
export class UserNotificationsComponent implements OnInit {
  private userNotificationService = inject(UserNotificationService)
  private notifier = inject(Notifier)

  readonly inPopup = input.required({ transform: booleanAttribute })
  readonly ignoreLoadingBar = input(false)
  readonly infiniteScroll = input(true)
  readonly itemsPerPage = input(20)
  readonly markAllAsReadSubject = input<Subject<boolean>>(undefined)
  readonly userNotificationReload = input<Subject<boolean>>(undefined)

  readonly notificationsLoaded = output()

  groupByDateStore = new Set<number>()
  groupedDateLabels: GroupDateLabels = {
    [GroupDate.TODAY]: $localize`Today`,
    [GroupDate.YESTERDAY]: $localize`Yesterday`,
    [GroupDate.THIS_WEEK]: $localize`This week`,
    [GroupDate.THIS_MONTH]: $localize`This month`,
    [GroupDate.LAST_MONTH]: $localize`Last month`,
    [GroupDate.OLDER]: $localize`Older`
  }

  notifications: UserNotification[] = []
  sortField = 'createdAt'

  componentPagination: ComponentPagination

  onDataSubject = new Subject<any[]>()

  ngOnInit () {
    this.componentPagination = {
      currentPage: 1,
      itemsPerPage: this.itemsPerPage(),
      totalItems: null
    }

    this.loadNotifications()

    const markAllAsReadSubject = this.markAllAsReadSubject()
    if (markAllAsReadSubject) {
      markAllAsReadSubject.subscribe(() => this.markAllAsRead())
    }

    const userNotificationReload = this.userNotificationReload()
    if (userNotificationReload) {
      userNotificationReload.subscribe(() => this.loadNotifications(true))
    }
  }

  loadNotifications (reset?: boolean) {
    if (reset) this.componentPagination.currentPage = 1

    const options = {
      pagination: this.componentPagination,
      ignoreLoadingBar: this.ignoreLoadingBar(),
      sort: {
        field: this.sortField,
        // if we order by creation date, we want DESC. all other fields are ASC (like unread).
        order: this.sortField === 'createdAt' ? -1 : 1
      }
    }

    this.userNotificationService.listMyNotifications(options)
      .subscribe({
        next: result => {
          this.notifications = reset ? result.data : this.notifications.concat(result.data)
          this.componentPagination.totalItems = result.total

          this.notificationsLoaded.emit()

          this.onDataSubject.next(result.data)
        },

        error: err => this.notifier.handleError(err)
      })
  }

  onNearOfBottom () {
    if (this.infiniteScroll() === false) return

    this.componentPagination.currentPage++

    if (hasMoreItems(this.componentPagination)) {
      this.loadNotifications()
    }
  }

  markAsRead (notification: UserNotification) {
    if (notification.payload.read) return

    this.userNotificationService.markAsRead(notification)
      .subscribe({
        next: () => {
          notification.payload.read = true
        },

        error: err => this.notifier.handleError(err)
      })
  }

  markAllAsRead () {
    this.userNotificationService.markAllAsRead()
      .subscribe({
        next: () => {
          for (const notification of this.notifications) {
            notification.payload.read = true
          }
        },

        error: err => this.notifier.handleError(err)
      })
  }

  changeSortColumn (column: string) {
    this.componentPagination = {
      currentPage: 1,
      itemsPerPage: this.itemsPerPage(),
      totalItems: null
    }
    this.sortField = column
    this.loadNotifications(true)
  }
}
