import { Subject } from 'rxjs'
import { Component } from '@angular/core'
import { ComponentPagination, Notifier } from '@app/core'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'
import { RouterLink } from '@angular/router'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/angular/infinite-scroller.directive'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { NgIf, NgFor } from '@angular/common'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'

@Component({
  templateUrl: './my-subscriptions.component.html',
  styleUrls: [ './my-subscriptions.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    AdvancedInputFilterComponent,
    InfiniteScrollerDirective,
    NgFor,
    ActorAvatarComponent,
    RouterLink,
    SubscribeButtonComponent
  ]
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
        .subscribe({
          next: res => {
            this.videoChannels = more
              ? this.videoChannels.concat(res.data)
              : res.data
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          error: err => this.notifier.error(err.message)
        })
  }
}
