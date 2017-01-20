import { NgModule } from '@angular/core';

import { VideosRoutingModule } from './videos-routing.module';
import { VideosComponent } from './videos.component';
import { VideoAddComponent } from './video-add';
import { VideoListComponent, VideoMiniatureComponent, VideoSortComponent } from './video-list';
import {
  VideoWatchComponent,
  VideoMagnetComponent,
  VideoReportComponent,
  VideoShareComponent,
  WebTorrentService
} from './video-watch';
import { LoaderComponent, VideoService } from './shared';
import { SharedModule } from '../shared';

@NgModule({
  imports: [
    VideosRoutingModule,
    SharedModule
  ],

  declarations: [
    VideosComponent,

    VideoAddComponent,

    VideoListComponent,
    VideoMiniatureComponent,
    VideoSortComponent,

    VideoWatchComponent,
    VideoMagnetComponent,
    VideoShareComponent,
    VideoReportComponent,

    LoaderComponent
  ],

  exports: [
    VideosComponent
  ],

  providers: [
    VideoService,
    WebTorrentService
  ]
})
export class VideosModule { }
