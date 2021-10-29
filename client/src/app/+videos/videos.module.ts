import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '@app/shared/shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { OverviewService, VideosListCommonPageComponent } from './video-list'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoUserSubscriptionsComponent } from './video-list/video-user-subscriptions.component'
import { VideosRoutingModule } from './videos-routing.module'

@NgModule({
  imports: [
    VideosRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedVideoMiniatureModule,
    SharedUserSubscriptionModule,
    SharedGlobalIconModule,
    SharedActorImageModule
  ],

  declarations: [
    VideoUserSubscriptionsComponent,
    VideoOverviewComponent,
    VideosListCommonPageComponent
  ],

  exports: [],

  providers: [
    OverviewService
  ]
})
export class VideosModule { }
