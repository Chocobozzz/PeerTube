import { Routes } from '@angular/router'
import { VideoWatchComponent } from './video-watch.component'
import { OverviewService } from '../video-list'
import { RecentVideosRecommendationService, RecommendedVideosStore } from './shared'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'

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
      SearchService,
      AbuseService
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
