import { NgModule } from '@angular/core'
import { LinkifierService } from '@app/videos/+video-watch/comment/linkifier.service'
import { VideoSupportComponent } from '@app/videos/+video-watch/modal/video-support.component'
import { ClipboardModule } from 'ngx-clipboard'
import { SharedModule } from '../../shared'
import { MarkdownService } from '../shared'
import { VideoCommentAddComponent } from './comment/video-comment-add.component'
import { VideoCommentComponent } from './comment/video-comment.component'
import { VideoCommentService } from './comment/video-comment.service'
import { VideoCommentsComponent } from './comment/video-comments.component'
import { VideoDownloadComponent } from './modal/video-download.component'
import { VideoReportComponent } from './modal/video-report.component'
import { VideoShareComponent } from './modal/video-share.component'
import { VideoWatchRoutingModule } from './video-watch-routing.module'
import { VideoWatchComponent } from './video-watch.component'
import { NgxQRCodeModule } from 'ngx-qrcode2'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { VideoBlacklistComponent } from '@app/videos/+video-watch/modal/video-blacklist.component'

@NgModule({
  imports: [
    VideoWatchRoutingModule,
    SharedModule,
    ClipboardModule,
    NgbTooltipModule.forRoot(),
    NgxQRCodeModule
  ],

  declarations: [
    VideoWatchComponent,

    VideoDownloadComponent,
    VideoShareComponent,
    VideoReportComponent,
    VideoBlacklistComponent,
    VideoSupportComponent,
    VideoCommentsComponent,
    VideoCommentAddComponent,
    VideoCommentComponent
  ],

  exports: [
    VideoWatchComponent
  ],

  providers: [
    MarkdownService,
    LinkifierService,
    VideoCommentService
  ]
})
export class VideoWatchModule { }
