import { NgModule } from '@angular/core'
import { VideoLocalComponent } from '@app/videos/video-list/video-local.component'
import { SharedModule } from '../shared'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoTrendingComponent } from './video-list/video-trending.component'
import { VideosRoutingModule } from './videos-routing.module'
import { VideosComponent } from './videos.component'
import { VideoUserSubscriptionsComponent } from '@app/videos/video-list/video-user-subscriptions.component'

@NgModule({
  imports: [
    VideosRoutingModule,
    SharedModule
  ],

  declarations: [
    VideosComponent,

    VideoTrendingComponent,
    VideoRecentlyAddedComponent,
    VideoLocalComponent,
    VideoUserSubscriptionsComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: []
})
export class VideosModule { }
