import { Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ComponentPagination, Notifier, resetCurrentPage } from '@app/core'
import { formatICU } from '@app/helpers'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { Subject } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'

@Component({
  templateUrl: './my-subscriptions.component.html',
  styleUrls: [ './my-subscriptions.component.scss' ],
  imports: [
    AdvancedInputFilterComponent,
    InfiniteScrollerDirective,
    ActorAvatarComponent,
    RouterLink,
    SubscribeButtonComponent
  ]
})
export class MySubscriptionsComponent {
  private userSubscriptionService = inject(UserSubscriptionService)
  private notifier = inject(Notifier)

  videoChannels: VideoChannel[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  search: string

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadSubscriptions()
  }

  onSearch (search: string) {
    this.search = search
    resetCurrentPage(this.pagination)

    this.loadSubscriptions(false)
  }

  getTotalTitle () {
    return formatICU(
      $localize`${this.pagination.totalItems} {total, plural, =1 {subscription} other {subscriptions}}`,
      { total: this.pagination.totalItems }
    )
  }

  private loadSubscriptions (more = true) {
    this.userSubscriptionService.listSubscriptions({ pagination: this.pagination, search: this.search })
      .subscribe({
        next: res => {
          this.videoChannels = more
            ? this.videoChannels.concat(res.data)
            : res.data
          this.pagination.totalItems = res.total

          this.onDataSubject.next(res.data)
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
