import { Routes } from '@angular/router'
import { SearchComponent } from './search.component'
import { ChannelLazyLoadResolver, PlaylistLazyLoadResolver, VideoLazyLoadResolver } from './shared'
import { UserSubscriptionService } from '../shared/shared-user-subscription/user-subscription.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'

export default [
  {
    path: '',
    component: SearchComponent,
    data: {
      meta: {
        title: $localize`Search`
      }
    },
    providers: [
      SearchService,
      VideoPlaylistService,
      UserSubscriptionService,
      BlocklistService,
      VideoBlockService,
      AbuseService,
      VideoLazyLoadResolver,
      ChannelLazyLoadResolver,
      PlaylistLazyLoadResolver
    ],
    children: [
      {
        path: 'lazy-load-video',
        component: SearchComponent,
        resolve: {
          data: VideoLazyLoadResolver
        }
      },
      {
        path: 'lazy-load-channel',
        component: SearchComponent,
        resolve: {
          data: ChannelLazyLoadResolver
        }
      },
      {
        path: 'lazy-load-playlist',
        component: SearchComponent,
        resolve: {
          data: PlaylistLazyLoadResolver
        }
      }
    ]
  }
] satisfies Routes
