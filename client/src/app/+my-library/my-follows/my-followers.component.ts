import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, Notifier, resetCurrentPage } from '@app/core'
import { formatICU } from '@app/helpers'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { ActorFollow } from '@peertube/peertube-models'
import { Subject } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilterComponent, FilterDef } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'

@Component({
  templateUrl: './my-followers.component.html',
  styleUrls: [ './my-followers.component.scss' ],
  imports: [ GlobalIconComponent, AdvancedInputFilterComponent, InfiniteScrollerDirective, ActorAvatarComponent ]
})
export class MyFollowersComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private auth = inject(AuthService)
  private userSubscriptionService = inject(UserSubscriptionService)
  private notifier = inject(Notifier)

  follows: ActorFollow[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()
  search: string

  inputFilters: FilterDef[]

  ngOnInit () {
    const channelOptions = this.auth.getUser().videoChannels.map(c => ({
      value: c.name,
      label: c.name
    }))

    this.inputFilters = [
      {
        type: 'options',
        key: 'channel',
        title: $localize`Channel filters`,
        options: channelOptions
      }
    ]
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadFollowers()
  }

  onSearch (search: string) {
    this.search = search
    resetCurrentPage(this.pagination)

    this.loadFollowers(false)
  }

  isFollowingAccount (follow: ActorFollow) {
    return follow.following.name === this.getUsername()
  }

  getTotalTitle () {
    return formatICU(
      $localize`${this.pagination.totalItems} {total, plural, =1 {follower} other {followers}}`,
      { total: this.pagination.totalItems }
    )
  }

  private loadFollowers (more = true) {
    this.userSubscriptionService.listFollowers({
      pagination: this.pagination,
      nameWithHost: this.getUsername(),
      search: this.search
    }).subscribe({
      next: res => {
        this.follows = more
          ? this.follows.concat(res.data)
          : res.data
        this.pagination.totalItems = res.total

        this.onDataSubject.next(res.data)
      },

      error: err => this.notifier.handleError(err)
    })
  }

  private getUsername () {
    return this.auth.getUser().username
  }
}
