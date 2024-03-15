import { Subject } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, ComponentPagination, Notifier } from '@app/core'
import { ActorFollow } from '@peertube/peertube-models'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/angular/infinite-scroller.directive'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { NgIf, NgFor } from '@angular/common'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'

@Component({
  templateUrl: './my-followers.component.html',
  styleUrls: [ './my-followers.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, NgIf, AdvancedInputFilterComponent, InfiniteScrollerDirective, NgFor, ActorAvatarComponent ]
})
export class MyFollowersComponent implements OnInit {
  follows: ActorFollow[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()
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

    this.auth.userInformationLoaded.subscribe(() => {
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
    })
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

      error: err => this.notifier.error(err.message)
    })
  }

  private getUsername () {
    return this.auth.getUser().username
  }
}
