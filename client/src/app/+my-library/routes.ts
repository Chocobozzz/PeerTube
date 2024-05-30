import { Routes } from '@angular/router'
import { LoginGuard } from '../core'
import { MyFollowersComponent } from './my-follows/my-followers.component'
import { MySubscriptionsComponent } from './my-follows/my-subscriptions.component'
import { MyHistoryComponent } from './my-history/my-history.component'
import { MyLibraryComponent } from './my-library.component'
import { MyOwnershipComponent } from './my-ownership/my-ownership.component'
import { MyVideoChannelSyncsComponent } from './my-video-channel-syncs/my-video-channel-syncs.component'
import { VideoChannelSyncEditComponent } from './my-video-channel-syncs/video-channel-sync-edit/video-channel-sync-edit.component'
import { MyVideoImportsComponent } from './my-video-imports/my-video-imports.component'
import { MyVideoPlaylistCreateComponent } from './my-video-playlists/my-video-playlist-create.component'
import { MyVideoPlaylistElementsComponent } from './my-video-playlists/my-video-playlist-elements.component'
import { MyVideoPlaylistUpdateComponent } from './my-video-playlists/my-video-playlist-update.component'
import { MyVideoPlaylistsComponent } from './my-video-playlists/my-video-playlists.component'
import { MyVideosComponent } from './my-videos/my-videos.component'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { userResolver } from '@app/core/routing/user.resolver'

export default [
  {
    path: '',
    component: MyLibraryComponent,
    providers: [
      VideoPlaylistService,
      BlocklistService,
      VideoBlockService,
      AbuseService,
      LiveVideoService,
      UserSubscriptionService
    ],
    resolve: {
      user: userResolver
    },
    canActivateChild: [ LoginGuard ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },

      {
        path: 'video-channels',
        loadChildren: () => import('./+my-video-channels/routes')
      },

      {
        path: 'video-playlists',
        component: MyVideoPlaylistsComponent,
        data: {
          meta: {
            title: $localize`My playlists`
          }
        }
      },
      {
        path: 'video-playlists/create',
        component: MyVideoPlaylistCreateComponent,
        data: {
          meta: {
            title: $localize`Create a new playlist`
          }
        }
      },
      {
        path: 'video-playlists/:videoPlaylistId',
        component: MyVideoPlaylistElementsComponent,
        data: {
          meta: {
            title: $localize`Playlist elements`
          }
        }
      },
      {
        path: 'video-playlists/update/:videoPlaylistId',
        component: MyVideoPlaylistUpdateComponent,
        data: {
          meta: {
            title: $localize`Update playlist`
          }
        }
      },

      {
        path: 'videos',
        component: MyVideosComponent,
        data: {
          meta: {
            title: $localize`My videos`
          },
          reuse: {
            enabled: true,
            key: 'my-videos-list'
          }
        }
      },
      {
        path: 'video-imports',
        component: MyVideoImportsComponent,
        data: {
          meta: {
            title: $localize`My video imports`
          }
        }
      },
      {
        path: 'subscriptions',
        component: MySubscriptionsComponent,
        data: {
          meta: {
            title: $localize`My subscriptions`
          }
        }
      },
      {
        path: 'followers',
        component: MyFollowersComponent,
        data: {
          meta: {
            title: $localize`My followers`
          }
        }
      },
      {
        path: 'ownership',
        component: MyOwnershipComponent,
        data: {
          meta: {
            title: $localize`Ownership changes`
          }
        }
      },

      {
        path: 'history/videos',
        component: MyHistoryComponent,
        data: {
          meta: {
            title: $localize`My video history`
          },
          reuse: {
            enabled: true,
            key: 'my-videos-history-list'
          }
        }
      },

      {
        path: 'video-channel-syncs',
        component: MyVideoChannelSyncsComponent,
        data: {
          meta: {
            title: $localize`My synchronizations`
          }
        }
      },

      {
        path: 'video-channel-syncs/create',
        component: VideoChannelSyncEditComponent,
        data: {
          meta: {
            title: $localize`Create new synchronization`
          }
        }
      }
    ]
  }
] satisfies Routes
