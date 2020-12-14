import { SortMeta } from 'primeng/api'
import { Component, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems, Notifier, RestService } from '@app/core'
import { InstanceFollowService } from '@app/shared/shared-instance'

@Component({
  selector: 'my-about-follows',
  templateUrl: './about-follows.component.html',
  styleUrls: [ './about-follows.component.scss' ]
})

export class AboutFollowsComponent implements OnInit {
  followers: string[] = []
  followings: string[] = []

  loadedAllFollowers = false
  loadedAllFollowings = false

  followersPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  }

  followingsPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  }

  sort: SortMeta = {
    field: 'createdAt',
    order: -1
  }

  constructor (
    private restService: RestService,
    private notifier: Notifier,
    private followService: InstanceFollowService
  ) { }

  ngOnInit () {
    this.loadMoreFollowers()

    this.loadMoreFollowings()
  }

  loadAllFollowings () {
    if (this.loadedAllFollowings) return

    this.loadedAllFollowings = true
    this.followingsPagination.itemsPerPage = 100

    this.loadMoreFollowings(true)

    while (hasMoreItems(this.followingsPagination)) {
      this.followingsPagination.currentPage += 1

      this.loadMoreFollowings()
    }
  }

  loadAllFollowers () {
    if (this.loadedAllFollowers) return

    this.loadedAllFollowers = true
    this.followersPagination.itemsPerPage = 100

    this.loadMoreFollowers(true)

    while (hasMoreItems(this.followersPagination)) {
      this.followersPagination.currentPage += 1

      this.loadMoreFollowers()
    }
  }

  buildLink (host: string) {
    return window.location.protocol + '//' + host
  }

  canLoadMoreFollowers () {
    return this.loadedAllFollowers || this.followersPagination.totalItems > this.followersPagination.itemsPerPage
  }

  canLoadMoreFollowings () {
    return this.loadedAllFollowings || this.followingsPagination.totalItems > this.followingsPagination.itemsPerPage
  }

  private loadMoreFollowers (reset = false) {
    const pagination = this.restService.componentPaginationToRestPagination(this.followersPagination)

    this.followService.getFollowers({ pagination: pagination, sort: this.sort, state: 'accepted' })
        .subscribe(
          resultList => {
            if (reset) this.followers = []

            const newFollowers = resultList.data.map(r => r.follower.host)
            this.followers = this.followers.concat(newFollowers)

            this.followersPagination.totalItems = resultList.total
          },

          err => this.notifier.error(err.message)
        )
  }

  private loadMoreFollowings (reset = false) {
    const pagination = this.restService.componentPaginationToRestPagination(this.followingsPagination)

    this.followService.getFollowing({ pagination, sort: this.sort, state: 'accepted' })
        .subscribe(
          resultList => {
            if (reset) this.followings = []

            const newFollowings = resultList.data.map(r => r.following.host)
            this.followings = this.followings.concat(newFollowings)

            this.followingsPagination.totalItems = resultList.total
          },

          err => this.notifier.error(err.message)
        )
  }

}
