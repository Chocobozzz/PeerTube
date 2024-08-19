import { Routes } from '@angular/router'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsComponent } from './video-channels.component'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'

export default [
  {
    path: ':videoChannelName',
    component: VideoChannelsComponent,
    providers: [
      VideoPlaylistService,
      UserSubscriptionService,
      BlocklistService,
      BulkService,
      AbuseService,
      VideoBlockService
    ],
    children: [
      {
        path: '',
        redirectTo: 'videos',
        pathMatch: 'full'
      },
      {
        path: 'videos',
        component: VideoChannelVideosComponent,
        data: {
          reuse: {
            enabled: true,
            key: 'video-channel-videos-list'
          }
        }
      },
      {
        path: 'video-playlists',
        component: VideoChannelPlaylistsComponent
      }
    ]
  }
] satisfies Routes
