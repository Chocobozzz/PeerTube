import { Routes } from '@angular/router'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsComponent } from './video-channels.component'
import { BlocklistService, BulkService, AbuseService, VideoBlockService } from '@app/shared/shared-moderation'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'

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
          meta: {
            title: $localize`Video channel videos`
          },
          reuse: {
            enabled: true,
            key: 'video-channel-videos-list'
          }
        }
      },
      {
        path: 'video-playlists',
        component: VideoChannelPlaylistsComponent,
        data: {
          meta: {
            title: $localize`Video channel playlists`
          }
        }
      }
    ]
  }
] satisfies Routes
