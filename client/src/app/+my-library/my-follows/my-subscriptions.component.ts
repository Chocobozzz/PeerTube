import { Component } from '@angular/core'
import { ComponentPagination, Notifier } from '@app/core'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'
import { RouterLink } from '@angular/router'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerComponent } from '../../shared/shared-main/common/infinite-scroller.component'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { NgIf, NgFor } from '@angular/common'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { formatICU } from '@app/helpers'

@Component({
  templateUrl: './my-subscriptions.component.html',
  styleUrls: [ './my-subscriptions.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    AdvancedInputFilterComponent,
    InfiniteScrollerComponent,
    NgFor,
    ActorAvatarComponent,
    RouterLink,
    SubscribeButtonComponent
  ]
})
export class MySubscriptionsComponent {
  videoChannels: VideoChannel[] = []
  hasMoreResults = true

  isLoading = true
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  search: string

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notifier: Notifier
  ) {}

  onPageChange () {
    this.loadSubscriptions()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) {
      return
    }

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

  onSearch (search: string) {
    this.search = search
    this.loadSubscriptions(false)
  }

  getTotalTitle () {
    return formatICU(
      $localize`You have ${this.pagination.totalItems} {total, plural, =1 {subscription} other {subscriptions}}`,
      { total: this.pagination.totalItems }
    )
  }

  private loadSubscriptions (more = true) {
    this.isLoading = true
    this.userSubscriptionService.listSubscriptions({ pagination: this.pagination, search: this.search })
        .subscribe({
          next: res => {
            this.videoChannels = more
              ? this.videoChannels.concat(res.data)
              : res.data
            this.pagination.totalItems = res.total
            this.hasMoreResults = (this.pagination.itemsPerPage * this.pagination.currentPage) < this.pagination.totalItems
            this.isLoading = false
          },

          error: err => this.notifier.error(err.message)
        })
  }
}
