
import { switchMap } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, LocalStorageService, Notifier, ScopedTokensService, ScreenService, ServerService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { immutableAssign } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { AbstractVideoList, OwnerDisplayType } from '@app/shared/shared-video-miniature'
import { FeedFormat, VideoSortField } from '@shared/models'
import { environment } from '../../../environments/environment'
import { copyToClipboard } from '../../../root-helpers/utils'

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
    private hooks: HooksService,
    private videoService: VideoService,
    private scopedTokensService: ScopedTokensService
  ) {
    super()

    this.titlePage = $localize`Videos from your subscriptions`

    this.actions.push({
      routerLink: '/my-library/subscriptions',
      label: $localize`Subscriptions`,
      iconName: 'cog'
    })
  }

  ngOnInit () {
    super.ngOnInit()

    const user = this.authService.getUser()
    let feedUrl = environment.originServerUrl

    this.authService.userInformationLoaded
      .pipe(switchMap(() => this.scopedTokensService.getScopedTokens()))
      .subscribe(
        tokens => {
          const feeds = this.videoService.getVideoSubscriptionFeedUrls(user.account.id, tokens.feedToken)
          feedUrl = feedUrl + feeds.find(f => f.format === FeedFormat.RSS).url

          this.actions.unshift({
            label: $localize`Copy feed URL`,
            iconName: 'syndication',
            justIcon: true,
            href: feedUrl,
            click: e => {
              e.preventDefault()
              copyToClipboard(feedUrl)
              this.activateCopiedMessage()
            }
          })
        },

        err => {
          this.notifier.error(err.message)
        }
      )
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

  activateCopiedMessage () {
    this.notifier.success($localize`Feed URL copied`)
  }
}
