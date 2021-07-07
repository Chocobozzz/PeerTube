import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedShareModal } from '@app/shared/shared-share-modal'
import { SharedSupportModal } from '@app/shared/shared-support-modal'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoModule } from '@app/shared/shared-video'
import { SharedVideoCommentModule } from '@app/shared/shared-video-comment'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { SharedActorImageModule } from '../../shared/shared-actor-image/shared-actor-image.module'
import { VideoCommentService } from '../../shared/shared-video-comment/video-comment.service'
import { PlayerStylesComponent } from './player-styles.component'
import {
  ActionButtonsComponent,
  PrivacyConcernsComponent,
  RecommendationsModule,
  VideoAlertComponent,
  VideoAvatarChannelComponent,
  VideoDescriptionComponent,
  VideoRateComponent,
  VideoWatchPlaylistComponent,
  VideoAttributesComponent
} from './shared'
import { VideoCommentAddComponent } from './shared/comment/video-comment-add.component'
import { VideoCommentComponent } from './shared/comment/video-comment.component'
import { VideoCommentsComponent } from './shared/comment/video-comments.component'
import { TimestampRouteTransformerDirective } from './shared/timestamp-route-transformer.directive'
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
    SharedShareModal,
    SharedVideoModule,
    SharedSupportModal,
    SharedActorImageModule
  ],

  declarations: [
    VideoWatchComponent,
    VideoWatchPlaylistComponent,
    VideoRateComponent,
    VideoDescriptionComponent,
    PrivacyConcernsComponent,
    ActionButtonsComponent,
    VideoAlertComponent,
    VideoAttributesComponent,

    VideoCommentsComponent,
    VideoCommentAddComponent,
    VideoCommentComponent,
    VideoAvatarChannelComponent,

    VideoAvatarChannelComponent,

    TimestampRouteTransformerDirective,

    PlayerStylesComponent
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
