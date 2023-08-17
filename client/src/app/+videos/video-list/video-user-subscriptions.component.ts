
import { firstValueFrom } from 'rxjs'
import { switchMap, tap } from 'rxjs/operators'
import { Component } from '@angular/core'
import { AuthService, ComponentPaginationLight, DisableForReuseHook, ScopedTokensService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { VideoService } from '@app/shared/shared-main'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { VideoFilters } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@peertube/peertube-models'

@Component({
  selector: 'my-videos-user-subscriptions',
  templateUrl: './video-user-subscriptions.component.html'
})
export class VideoUserSubscriptionsComponent implements DisableForReuseHook {
  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  defaultSort = '-publishedAt' as VideoSortField

  actions = [
    {
      routerLink: '/my-library/subscriptions',
      label: $localize`Subscriptions`,
      iconName: 'cog' as 'cog'
    }
  ]

  titlePage = $localize`Videos from your subscriptions`

  disabled = false

  private feedToken: string

  constructor (
    private authService: AuthService,
    private userSubscription: UserSubscriptionService,
    private hooks: HooksService,
    private videoService: VideoService,
    private scopedTokensService: ScopedTokensService
  ) {

  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    const params = {
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
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

  getSyndicationItems () {
    return this.loadFeedToken()
      .then(() => {
        const user = this.authService.getUser()

        return this.videoService.getVideoSubscriptionFeedUrls(user.account.id, this.feedToken)
      })
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  private loadFeedToken () {
    if (this.feedToken) return Promise.resolve(this.feedToken)

    const obs = this.authService.userInformationLoaded
      .pipe(
        switchMap(() => this.scopedTokensService.getScopedTokens()),
        tap(tokens => this.feedToken = tokens.feedToken)
      )

    return firstValueFrom(obs)
  }
}
