
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms/shared-form.module'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { BatchDomainsModalComponent } from './batch-domains-modal.component'
import { BlocklistService } from './blocklist.service'
import { BulkService } from './bulk.service'
import { UserBanModalComponent } from './user-ban-modal.component'
import { UserModerationDropdownComponent } from './user-moderation-dropdown.component'
import { AbuseService } from './abuse.service'
import { VideoBlockComponent } from './video-block.component'
import { VideoBlockService } from './video-block.service'
import { VideoReportComponent } from './video-report.component'
import { CommentReportComponent } from './comment-report.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    UserBanModalComponent,
    UserModerationDropdownComponent,
    VideoBlockComponent,
    VideoReportComponent,
    BatchDomainsModalComponent,
    CommentReportComponent
  ],

  exports: [
    UserBanModalComponent,
    UserModerationDropdownComponent,
    VideoBlockComponent,
    VideoReportComponent,
    BatchDomainsModalComponent,
    CommentReportComponent
  ],

  providers: [
    BlocklistService,
    BulkService,
    AbuseService,
    VideoBlockService
  ]
})
export class SharedModerationModule { }
