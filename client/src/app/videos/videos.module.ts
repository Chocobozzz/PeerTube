import { NgModule } from '@angular/core';

import { TagInputModule } from 'ng2-tag-input';

import { VideosRoutingModule } from './videos-routing.module';
import { VideosComponent } from './videos.component';
import { VideoAddComponent, VideoUpdateComponent } from './video-edit';
import { LoaderComponent, VideoListComponent, VideoMiniatureComponent, VideoSortComponent } from './video-list';
import {
  VideoWatchComponent,
  VideoMagnetComponent,
  VideoReportComponent,
  VideoShareComponent,
  WebTorrentService
} from './video-watch';
import { VideoService } from './shared';
import { SharedModule } from '../shared';

@NgModule({
  imports: [
    TagInputModule,

    VideosRoutingModule,
    SharedModule
  ],

  declarations: [
    VideosComponent,

    VideoAddComponent,
    VideoUpdateComponent,

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
