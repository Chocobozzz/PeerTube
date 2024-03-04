import { Routes } from '@angular/router'
import { SearchComponent } from './search.component'
import { ChannelLazyLoadResolver, PlaylistLazyLoadResolver, VideoLazyLoadResolver } from './shared'
import { UserSubscriptionService } from '../shared/shared-user-subscription/user-subscription.service'
import { VideoPlaylistService } from '../shared/shared-video-playlist'
import { SearchService } from '@app/shared/shared-search'

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
      UserSubscriptionService
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
