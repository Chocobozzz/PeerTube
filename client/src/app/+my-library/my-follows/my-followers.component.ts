import { NgFor, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, Notifier } from '@app/core'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { ActorFollow } from '@peertube/peertube-models'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { InfiniteScrollerComponent } from '../../shared/shared-main/common/infinite-scroller.component'
import { formatICU } from '@app/helpers'

@Component({
  templateUrl: './my-followers.component.html',
  styleUrls: [ './my-followers.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, NgIf, AdvancedInputFilterComponent, InfiniteScrollerComponent, NgFor, ActorAvatarComponent ]
})
export class MyFollowersComponent implements OnInit {
  follows: ActorFollow[] = []
  hasMoreResults = true
  isLoading = true

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  search: string

  inputFilters: AdvancedInputFilter[]

  constructor (
    private route: ActivatedRoute,
    private auth: AuthService,
    private userSubscriptionService: UserSubscriptionService,
    private notifier: Notifier
  ) {}

  ngOnInit () {
    if (this.route.snapshot.queryParams['search']) {
      this.search = this.route.snapshot.queryParams['search']
    }

    const channelFilters = this.auth.getUser().videoChannels.map(c => {
      return {
        value: 'channel:' + c.name,
        label: c.name
      }
    })

    this.inputFilters = [
      {
        title: $localize`Channel filters`,
        children: channelFilters
      }
    ]
  }

  onPageChange () {
    this.loadFollowers(false)
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadFollowers()
  }

  onSearch (search: string) {
    this.search = search
    this.loadFollowers(false)
  }

  isFollowingAccount (follow: ActorFollow) {
    return follow.following.name === this.getUsername()
  }

  getTotalTitle () {
    return formatICU(
      $localize`You have ${this.pagination.totalItems} {total, plural, =1 {follower} other {followers}}`,
      { total: this.pagination.totalItems }
    )
  }

  private loadFollowers (more = true) {
    this.isLoading = true

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
        this.hasMoreResults = (this.pagination.itemsPerPage * this.pagination.currentPage) < this.pagination.totalItems

        this.isLoading = false
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private getUsername () {
    return this.auth.getUser().username
  }
}
