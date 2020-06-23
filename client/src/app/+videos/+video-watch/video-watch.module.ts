import { QRCodeModule } from 'angularx-qrcode'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { VideoCommentAddComponent } from './comment/video-comment-add.component'
import { VideoCommentComponent } from './comment/video-comment.component'
import { VideoCommentService } from './comment/video-comment.service'
import { VideoCommentsComponent } from './comment/video-comments.component'
import { VideoShareComponent } from './modal/video-share.component'
import { VideoSupportComponent } from './modal/video-support.component'
import { TimestampRouteTransformerDirective } from './timestamp-route-transformer.directive'
import { VideoDurationPipe } from './video-duration-formatter.pipe'
import { VideoWatchPlaylistComponent } from './video-watch-playlist.component'
import { VideoWatchRoutingModule } from './video-watch-routing.module'
import { VideoWatchComponent } from './video-watch.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    NgbTooltipModule,
    QRCodeModule,
    RecommendationsModule,

    SharedMainModule,
    SharedFormModule,
    SharedVideoMiniatureModule,
    SharedVideoPlaylistModule,
    SharedUserSubscriptionModule,
    SharedModerationModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideoWatchComponent,
    VideoWatchPlaylistComponent,

    VideoShareComponent,
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
