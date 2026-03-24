import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, Notifier, resetCurrentPage } from '@app/core'
import { formatICU } from '@app/helpers'
import { SearchInputComponent } from '@app/shared/shared-forms/search-input.component'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { ActorFollow } from '@peertube/peertube-models'
import { Subject } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedFilterDef, AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'

@Component({
  templateUrl: './my-followers.component.html',
  styleUrls: [ './my-followers.component.scss' ],
  imports: [ GlobalIconComponent, AdvancedInputFilterComponent, InfiniteScrollerDirective, ActorAvatarComponent, SearchInputComponent ]
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
  channelFilter: string

  inputFilters: AdvancedFilterDef<{ channel: string }>[]

  ngOnInit () {
    this.inputFilters = [
      {
        type: 'select',
        key: 'channel',
        title: $localize`Channel`,
        items: this.auth.getUser().videoChannels.map(c => ({
          id: c.name,
          label: c.displayName
        }))
      }
    ]

    this.search = this.route.snapshot.queryParamMap.get('search') || ''
    this.channelFilter = this.route.snapshot.queryParamMap.get('channel') || ''

    this.loadFollowers()
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

    this.loadFollowers({ more: false })
  }

  onFilter (filters: {
    channel?: string
  }) {
    this.channelFilter = filters.channel
    resetCurrentPage(this.pagination)

    this.loadFollowers({ more: false })
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

  private loadFollowers (options: {
    more?: boolean
  } = {}) {
    const { more = false } = options

    this.userSubscriptionService.listFollowers({
      pagination: this.pagination,
      nameWithHost: this.getUsername(),
      search: this.search,
      channel: this.channelFilter
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
