import { NgModule } from '@angular/core'

import { VideosRoutingModule } from './videos-routing.module'
import { VideosComponent } from './videos.component'
import { LoaderComponent, VideoListComponent, VideoMiniatureComponent, VideoSortComponent } from './video-list'
import { VideoService } from './shared'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    VideosRoutingModule,
    SharedModule
  ],

  declarations: [
    VideosComponent,

    VideoListComponent,
    VideoMiniatureComponent,
    VideoSortComponent,

    LoaderComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideosModule { }
