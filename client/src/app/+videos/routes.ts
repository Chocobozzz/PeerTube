import { inject } from '@angular/core'
import { Routes } from '@angular/router'
import { LoginGuard, RedirectService } from '@app/core'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { OverviewService, VideosListAllComponent } from './video-list'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoUserSubscriptionsComponent } from './video-list/video-user-subscriptions.component'

export default [
  {
    path: '',
    providers: [
      OverviewService,
      UserSubscriptionService,
      VideoPlaylistService,
      BlocklistService,
      VideoBlockService,
      AbuseService
    ],
    children: [
      {
        path: 'overview',
        component: VideoOverviewComponent,
        data: {
          meta: {
            title: $localize`Discover videos`
          },
          reuse: {
            enabled: true,
            key: 'videos-discover'
          }
        }
      },

      // ---------------------------------------------------------------------------
      // Old URL redirections
      // ---------------------------------------------------------------------------
      {
        path: 'most-liked',
        redirectTo: 'browse?scope=federated&sort=-likes'
      },
      {
        path: 'trending',
        redirectTo: () => {
          const redirectService = inject(RedirectService)

          return 'browse?scope=federated&sort=-' + redirectService.getDefaultTrendingSort()
        }
      },
      {
        path: 'recently-added',
        redirectTo: 'browse?scope=federated&sort=-publishedAt'
      },
      {
        path: 'local',
        redirectTo: 'browse?scope=local&sort=-publishedAt'
      },

      // ---------------------------------------------------------------------------

      {
        path: 'browse',

        component: VideosListAllComponent,
        data: {
          reuse: {
            enabled: true,
            key: 'videos-list'
          }
        }
      },

      {
        path: 'subscriptions',
        canActivate: [ LoginGuard ],
        component: VideoUserSubscriptionsComponent,
        data: {
          meta: {
            title: $localize`Subscriptions`
          },
          reuse: {
            enabled: true,
            key: 'subscription-videos-list'
          }
        }
      }
    ]
  }
] satisfies Routes
