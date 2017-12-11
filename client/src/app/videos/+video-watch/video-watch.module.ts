import { NgModule } from '@angular/core'

import { VideoWatchRoutingModule } from './video-watch-routing.module'
import { MarkdownService } from '../shared'
import { SharedModule } from '../../shared'
import { ClipboardModule } from 'ngx-clipboard'

import { VideoWatchComponent } from './video-watch.component'
import { VideoReportComponent } from './video-report.component'
import { VideoShareComponent } from './video-share.component'
import { VideoDownloadComponent } from './video-download.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    SharedModule,
    ClipboardModule
  ],

  declarations: [
    VideoWatchComponent,

    VideoDownloadComponent,
    VideoShareComponent,
    VideoReportComponent
  ],

  exports: [
    VideoWatchComponent
  ],

  providers: [
    MarkdownService
  ]
})
export class VideoWatchModule { }
