import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserSubscriptionService } from '@app/shared/user-subscription'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'

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

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notificationsService: NotificationsService,
    private i18n: I18n
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
          },

          error => this.notificationsService.error(this.i18n('Error'), error.message)
        )
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

}
