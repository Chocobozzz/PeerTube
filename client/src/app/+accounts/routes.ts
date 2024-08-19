import { Routes } from '@angular/router'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountsComponent } from './accounts.component'

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
      VideoBlockService,
      AbuseService,
      UserAdminService,
      BulkService
    ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },
      {
        path: 'video-channels',
        component: AccountVideoChannelsComponent
      },
      {
        path: 'videos',
        component: AccountVideosComponent,
        data: {
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
