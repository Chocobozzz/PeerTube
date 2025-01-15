import { DecimalPipe, NgFor, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ComponentPagination, hasMoreItems, Notifier, RestService, ServerService } from '@app/core'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { PluginSelectorDirective } from '@app/shared/shared-main/plugins/plugin-selector.directive'
import { Actor, ServerStats } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { FollowerImageComponent } from './follower-image.component'
import { SubscriptionImageComponent } from './subscription-image.component'

@Component({
  selector: 'my-about-follows',
  templateUrl: './about-follows.component.html',
  styleUrls: [ './about-follows.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ActorAvatarComponent,
    ButtonComponent,
    PluginSelectorDirective,
    GlobalIconComponent,
    DecimalPipe,
    RouterLink,
    SubscriptionImageComponent,
    FollowerImageComponent
  ]
})

export class AboutFollowsComponent implements OnInit {
  instanceName: string

  followers: Actor[] = []
  subscriptions: Actor[] = []

  followersPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  }

  subscriptionsPagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  }

  serverStats: ServerStats

  private loadingFollowers = false
  private loadingSubscriptions = false

  private sort: SortMeta = {
    field: 'createdAt',
    order: -1
  }

  constructor (
    private server: ServerService,
    private restService: RestService,
    private notifier: Notifier,
    private followService: InstanceFollowService
  ) { }

  ngOnInit () {
    this.loadMoreFollowers(true)
    this.loadMoreSubscriptions(true)

    this.instanceName = this.server.getHTMLConfig().instance.name

    this.server.getServerStats().subscribe(stats => this.serverStats = stats)
  }

  buildLink (host: string) {
    return window.location.protocol + '//' + host
  }

  canLoadMoreFollowers () {
    return hasMoreItems(this.followersPagination)
  }

  canLoadMoreSubscriptions () {
    return hasMoreItems(this.subscriptionsPagination)
  }

  loadMoreFollowers (reset = false) {
    if (this.loadingFollowers) return
    this.loadingFollowers = true

    if (reset) this.followersPagination.currentPage = 1
    else this.followersPagination.currentPage++

    const pagination = this.restService.componentToRestPagination(this.followersPagination)

    this.followService.getFollowers({ pagination, sort: this.sort, state: 'accepted' })
        .subscribe({
          next: resultList => {
            if (reset) this.followers = []

            const newFollowers = resultList.data.map(r => this.formatFollow(r.follower))
            this.followers = this.followers.concat(newFollowers)

            this.followersPagination.totalItems = resultList.total
          },

          error: err => this.notifier.error(err.message),

          complete: () => this.loadingFollowers = false
        })
  }

  loadMoreSubscriptions (reset = false) {
    if (this.loadingSubscriptions) return
    this.loadingSubscriptions = true

    if (reset) this.subscriptionsPagination.currentPage = 1
    else this.subscriptionsPagination.currentPage++

    const pagination = this.restService.componentToRestPagination(this.subscriptionsPagination)

    this.followService.getFollowing({ pagination, sort: this.sort, state: 'accepted' })
        .subscribe({
          next: resultList => {
            if (reset) this.subscriptions = []

            const newFollowings = resultList.data.map(r => this.formatFollow(r.following))
            this.subscriptions = this.subscriptions.concat(newFollowings)

            this.subscriptionsPagination.totalItems = resultList.total
          },

          error: err => this.notifier.error(err.message),

          complete: () => this.loadingSubscriptions = false
        })
  }

  private formatFollow (actor: Actor) {
    return {
      ...actor,

      // Instance follow, only display host
      name: actor.name === 'peertube'
        ? actor.host
        : actor.name + '@' + actor.host
    }
  }
}
