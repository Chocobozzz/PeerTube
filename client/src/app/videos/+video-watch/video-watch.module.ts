import { NgModule } from '@angular/core'
import { TooltipModule } from 'ngx-bootstrap/tooltip'
import { ClipboardModule } from 'ngx-clipboard'
import { SharedModule } from '../../shared'
import { MarkdownService } from '../shared'
import { VideoDownloadComponent } from './video-download.component'
import { VideoReportComponent } from './video-report.component'
import { VideoShareComponent } from './video-share.component'

import { VideoWatchRoutingModule } from './video-watch-routing.module'

import { VideoWatchComponent } from './video-watch.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    SharedModule,
    ClipboardModule,
    TooltipModule.forRoot()
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
