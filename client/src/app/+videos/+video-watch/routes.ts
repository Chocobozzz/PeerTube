import { Routes } from '@angular/router'
import { VideoWatchComponent } from './video-watch.component'
import { BlocklistService, VideoBlockService } from '@app/shared/shared-moderation'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { OverviewService } from '../video-list'
import { LiveVideoService } from '@app/shared/shared-video-live'
import { VideoCommentService } from '@app/shared/shared-video-comment'
import { RecentVideosRecommendationService, RecommendedVideosStore } from './shared'
import { SearchService } from '@app/shared/shared-search'

export default [
  {
    path: '',
    providers: [
      OverviewService,
      UserSubscriptionService,
      VideoPlaylistService,
      BlocklistService,
      VideoBlockService,
      LiveVideoService,
      VideoCommentService,
      RecentVideosRecommendationService,
      RecommendedVideosStore,
      SearchService
    ],
    children: [
      {
        path: 'p/:playlistId',
        component: VideoWatchComponent
      },
      {
        path: ':videoId/comments/:commentId',
        redirectTo: ':videoId'
      },
      {
        path: ':videoId',
        component: VideoWatchComponent
      }
    ]
  }
] satisfies Routes
