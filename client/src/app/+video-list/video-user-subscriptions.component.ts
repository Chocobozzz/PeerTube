import { Component, inject } from '@angular/core'
import { AuthService, ComponentPaginationLight, DisableForReuseHook, ScopedTokensService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'
import { VideosListComponent } from '@app/shared/shared-video-miniature/videos-list.component'
import { VideoSortField } from '@peertube/peertube-models'
import { firstValueFrom } from 'rxjs'
import { first, switchMap, tap } from 'rxjs/operators'

@Component({
  selector: 'my-videos-user-subscriptions',
  templateUrl: './video-user-subscriptions.component.html',
  imports: [ VideosListComponent ]
})
export class VideoUserSubscriptionsComponent implements DisableForReuseHook {
  private authService = inject(AuthService)
  private userSubscription = inject(UserSubscriptionService)
  private hooks = inject(HooksService)
  private videoService = inject(VideoService)
  private scopedTokensService = inject(ScopedTokensService)

  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  defaultSort = '-publishedAt' as VideoSortField

  actions = [
    {
      routerLink: '/my-library/subscriptions',
      label: $localize`Manage`,
      iconName: 'cog' as 'cog'
    }
  ]

  disabled = false

  private feedToken: string

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
        first(),
        switchMap(() => this.scopedTokensService.getScopedTokens()),
        tap(tokens => this.feedToken = tokens.feedToken)
      )

    return firstValueFrom(obs)
  }
}
