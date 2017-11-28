import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { VideoService } from './shared'
import { MyVideosComponent, VideoListComponent, VideoMiniatureComponent, VideoSortComponent } from './video-list'
import { VideosRoutingModule } from './videos-routing.module'
import { VideosComponent } from './videos.component'

@NgModule({
  imports: [
    VideosRoutingModule,
    SharedModule
  ],

  declarations: [
    VideosComponent,

    VideoListComponent,
    MyVideosComponent,
    VideoMiniatureComponent,
    VideoSortComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideosModule { }
