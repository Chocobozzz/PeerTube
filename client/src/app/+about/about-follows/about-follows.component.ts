import { SortMeta } from 'primeng/api'
import { Subject } from 'rxjs'
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
  moreFollowers: string[] = []
  moreFollowings: string[] = []

  showMoreFollowers = false
  showMoreFollowings = false

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

  onDataSubject = new Subject<any[]>()

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
    while (hasMoreItems(this.followingsPagination)) {
      this.followingsPagination.currentPage += 1

      this.loadMoreFollowings()
    }
  }

  loadAllFollowers () {
    while (hasMoreItems(this.followersPagination)) {
      this.followersPagination.currentPage += 1

      this.loadMoreFollowers()
    }
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
            if (this.followers.length === 0) this.followers = this.followers.concat(newFollowers)

            else this.moreFollowers = this.moreFollowers.concat(newFollowers)

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
            if (this.followings.length === 0) this.followings = this.followings.concat(newFollowings)

            else this.moreFollowings = this.moreFollowings.concat(newFollowings)

            this.followingsPagination.totalItems = resultList.total

            this.onDataSubject.next(newFollowings)
          },

          err => this.notifier.error(err.message)
        )
  }

}
