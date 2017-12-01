import { NgModule } from '@angular/core'
import { InfiniteScrollModule } from 'ngx-infinite-scroll'
import { SharedModule } from '../shared'
import { VideoService } from './shared'
import { VideoMiniatureComponent } from './video-list'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoTrendingComponent } from './video-list/video-trending.component'
import { VideosRoutingModule } from './videos-routing.module'
import { VideosComponent } from './videos.component'

@NgModule({
  imports: [
    VideosRoutingModule,
    SharedModule,
    InfiniteScrollModule
  ],

  declarations: [
    VideosComponent,

    VideoTrendingComponent,
    VideoRecentlyAddedComponent,
    VideoMiniatureComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideosModule { }
