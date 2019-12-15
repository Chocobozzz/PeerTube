import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { UserSubscriptionService } from '@app/shared/user-subscription'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Subject } from 'rxjs'

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

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notifier: Notifier
  ) {}

  ngOnInit () {
    this.loadSubscriptions()
  }

  loadSubscriptions () {
    this.userSubscriptionService.listSubscriptions(this.pagination)
        .subscribe(
          res => {
            this.videoChannels = this.videoChannels.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          error => this.notifier.error(error.message)
        )
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

}
