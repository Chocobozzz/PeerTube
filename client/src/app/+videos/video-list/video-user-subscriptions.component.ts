import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { immutableAssign } from '@app/helpers'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { AbstractVideoList, OwnerDisplayType } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@shared/models'

@Component({
  selector: 'my-videos-user-subscriptions',
  styleUrls: [ '../../shared/shared-video-miniature/abstract-video-list.scss' ],
  templateUrl: '../../shared/shared-video-miniature/abstract-video-list.html'
})
export class VideoUserSubscriptionsComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage: string
  sort = '-publishedAt' as VideoSortField
  ownerDisplayType: OwnerDisplayType = 'auto'
  groupByDate = true

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected userService: UserService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    private userSubscription: UserSubscriptionService,
    private hooks: HooksService
  ) {
    super()

    this.titlePage = $localize`Videos from your subscriptions`
    this.actions.push({
      routerLink: '/my-account/subscriptions',
      label: $localize`Subscriptions`,
      iconName: 'cog'
    })
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    const params = {
      videoPagination: newPagination,
      sort: this.sort,
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.userSubscription.getUserSubscriptionVideos.bind(this.userSubscription),
      params,
      'common',
      'filter:api.user-subscriptions-videos.videos.list.params',
      'filter:api.user-subscriptions-videos.videos.list.result'
    )
  }

  generateSyndicationList () {
    // not implemented yet
  }
}
