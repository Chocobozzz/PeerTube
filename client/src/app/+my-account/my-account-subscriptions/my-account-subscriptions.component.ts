import { Subject } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { ComponentPagination, Notifier } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { debounceTime } from 'rxjs/operators'

@Component({
  selector: 'my-account-subscriptions',
  templateUrl: './my-account-subscriptions.component.html',
  styleUrls: [ './my-account-subscriptions.component.scss' ]
})
export class MyAccountSubscriptionsComponent implements OnInit {
  videoChannels: VideoChannel[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  subscriptionsSearch: string
  subscriptionsSearchChanged = new Subject<string>()

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notifier: Notifier
  ) {}

  ngOnInit () {
    this.loadSubscriptions()

    this.subscriptionsSearchChanged
      .pipe(debounceTime(500))
      .subscribe(() => {
        this.pagination.currentPage = 1
        this.loadSubscriptions(false)
      })
  }

  resetSearch () {
    this.subscriptionsSearch = ''
    this.onSubscriptionsSearchChanged()
  }

  onSubscriptionsSearchChanged () {
    this.subscriptionsSearchChanged.next()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

  private loadSubscriptions (more = true) {
    this.userSubscriptionService.listSubscriptions({ pagination: this.pagination, search: this.subscriptionsSearch })
        .subscribe(
          res => {
            this.videoChannels = more
              ? this.videoChannels.concat(res.data)
              : res.data
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          error => this.notifier.error(error.message)
        )
  }
}
