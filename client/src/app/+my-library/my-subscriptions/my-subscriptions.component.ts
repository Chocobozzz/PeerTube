import { Subject } from 'rxjs'
import { Component } from '@angular/core'
import { ComponentPagination, Notifier } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'

@Component({
  templateUrl: './my-subscriptions.component.html',
  styleUrls: [ './my-subscriptions.component.scss' ]
})
export class MySubscriptionsComponent {
  videoChannels: VideoChannel[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  search: string

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notifier: Notifier
  ) {}

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

  onSearch (search: string) {
    this.search = search
    this.loadSubscriptions(false)
  }

  private loadSubscriptions (more = true) {
    this.userSubscriptionService.listSubscriptions({ pagination: this.pagination, search: this.search })
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
