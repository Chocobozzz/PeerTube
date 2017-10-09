import { NgModule } from '@angular/core'

import { VideoWatchRoutingModule } from './video-watch-routing.module'
import { VideoService } from '../shared'
import { SharedModule } from '../../shared'

import { VideoWatchComponent } from './video-watch.component'
import { VideoReportComponent } from './video-report.component'
import { VideoShareComponent } from './video-share.component'
import { VideoMagnetComponent } from './video-magnet.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    SharedModule
  ],

  declarations: [
    VideoWatchComponent,

    VideoMagnetComponent,
    VideoShareComponent,
    VideoReportComponent
  ],

  exports: [
    VideoWatchComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideoWatchModule { }
