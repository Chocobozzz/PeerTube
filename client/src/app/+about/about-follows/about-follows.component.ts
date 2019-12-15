import { Component, OnInit } from '@angular/core'
import { FollowService } from '@app/shared/instance/follow.service'
import { ComponentPagination, hasMoreItems } from '@app/shared/rest/component-pagination.model'
import { Notifier } from '@app/core'
import { RestService } from '@app/shared'
import { SortMeta } from 'primeng/api'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-about-follows',
  templateUrl: './about-follows.component.html',
  styleUrls: [ './about-follows.component.scss' ]
})

export class AboutFollowsComponent implements OnInit {
  followers: string[] = []
  followings: string[] = []

  followersPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: null
  }

  followingsPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: null
  }

  sort: SortMeta = {
    field: 'createdAt',
    order: -1
  }

  onDataSubject = new Subject<any[]>()

  constructor (
    private restService: RestService,
    private notifier: Notifier,
    private followService: FollowService
  ) { }

  ngOnInit () {
    this.loadMoreFollowers()

    this.loadMoreFollowings()
  }

  onNearOfBottom () {
    this.onNearOfFollowersBottom()

    this.onNearOfFollowingsBottom()
  }

  onNearOfFollowersBottom () {
    if (!hasMoreItems(this.followersPagination)) return

    this.followersPagination.currentPage += 1
    this.loadMoreFollowers()
  }

  onNearOfFollowingsBottom () {
    if (!hasMoreItems(this.followingsPagination)) return

    this.followingsPagination.currentPage += 1
    this.loadMoreFollowings()
  }

  buildLink (host: string) {
    return window.location.protocol + '//' + host
  }

  private loadMoreFollowers () {
    const pagination = this.restService.componentPaginationToRestPagination(this.followersPagination)

    this.followService.getFollowers({ pagination: pagination, sort: this.sort, state: 'accepted' })
        .subscribe(
          resultList => {
            const newFollowers = resultList.data.map(r => r.follower.host)
            this.followers = this.followers.concat(newFollowers)

            this.followersPagination.totalItems = resultList.total

            this.onDataSubject.next(newFollowers)
          },

          err => this.notifier.error(err.message)
        )
  }

  private loadMoreFollowings () {
    const pagination = this.restService.componentPaginationToRestPagination(this.followingsPagination)

    this.followService.getFollowing({ pagination, sort: this.sort, state: 'accepted' })
        .subscribe(
          resultList => {
            const newFollowings = resultList.data.map(r => r.following.host)
            this.followings = this.followings.concat(newFollowings)

            this.followingsPagination.totalItems = resultList.total

            this.onDataSubject.next(newFollowings)
          },

          err => this.notifier.error(err.message)
        )
  }

}
