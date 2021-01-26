import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { OverviewService } from './video-list'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoTrendingHeaderComponent } from './video-list/trending/video-trending-header.component'
import { VideoHotComponent } from './video-list/trending/video-hot.component'
import { VideoMostViewedComponent } from './video-list/trending/video-most-viewed.component'
import { VideoMostLikedComponent } from './video-list/trending/video-most-liked.component'
import { VideoLocalComponent } from './video-list/video-local.component'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoUserSubscriptionsComponent } from './video-list/video-user-subscriptions.component'
import { VideosRoutingModule } from './videos-routing.module'
import { VideosComponent } from './videos.component'

@NgModule({
  imports: [
    VideosRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedVideoMiniatureModule,
    SharedUserSubscriptionModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideosComponent,

    VideoTrendingHeaderComponent,
    VideoMostViewedComponent,
    VideoHotComponent,
    VideoMostLikedComponent,
    VideoRecentlyAddedComponent,
    VideoLocalComponent,
    VideoUserSubscriptionsComponent,
    VideoOverviewComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: [
    OverviewService
  ]
})
export class VideosModule { }
