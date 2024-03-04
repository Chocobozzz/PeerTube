import { Routes } from '@angular/router'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountsComponent } from './accounts.component'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { BlocklistService, VideoBlockService } from '@app/shared/shared-moderation'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'

export default [
  {
    path: 'peertube',
    redirectTo: '/videos/local'
  },
  {
    path: ':accountId',
    component: AccountsComponent,
    providers: [
      UserSubscriptionService,
      BlocklistService,
      VideoPlaylistService,
      VideoBlockService
    ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },
      {
        path: 'video-channels',
        component: AccountVideoChannelsComponent,
        data: {
          meta: {
            title: $localize`Account video channels`
          }
        }
      },
      {
        path: 'videos',
        component: AccountVideosComponent,
        data: {
          meta: {
            title: $localize`Account videos`
          },
          reuse: {
            enabled: true,
            key: 'account-videos-list'
          }
        }
      },

      // Old URL redirection
      {
        path: 'search',
        redirectTo: 'videos'
      }
    ]
  }
] satisfies Routes
