import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedShareModal } from '@app/shared/shared-share-modal'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoCommentModule } from '@app/shared/shared-video-comment'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { VideoCommentService } from '../../shared/shared-video-comment/video-comment.service'
import { VideoCommentAddComponent } from './comment/video-comment-add.component'
import { VideoCommentComponent } from './comment/video-comment.component'
import { VideoCommentsComponent } from './comment/video-comments.component'
import { VideoSupportComponent } from './modal/video-support.component'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { TimestampRouteTransformerDirective } from './timestamp-route-transformer.directive'
import { VideoDurationPipe } from './video-duration-formatter.pipe'
import { VideoWatchPlaylistComponent } from './video-watch-playlist.component'
import { VideoWatchRoutingModule } from './video-watch-routing.module'
import { VideoWatchComponent } from './video-watch.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    RecommendationsModule,

    SharedMainModule,
    SharedFormModule,
    SharedVideoMiniatureModule,
    SharedVideoPlaylistModule,
    SharedUserSubscriptionModule,
    SharedModerationModule,
    SharedGlobalIconModule,
    SharedVideoCommentModule,
    SharedShareModal
  ],

  declarations: [
    VideoWatchComponent,
    VideoWatchPlaylistComponent,

    VideoSupportComponent,
    VideoCommentsComponent,
    VideoCommentAddComponent,
    VideoCommentComponent,

    TimestampRouteTransformerDirective,
    VideoDurationPipe,
    TimestampRouteTransformerDirective
  ],

  exports: [
    VideoWatchComponent,

    TimestampRouteTransformerDirective
  ],

  providers: [
    VideoCommentService
  ]
})
export class VideoWatchModule { }
