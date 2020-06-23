
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms/shared-form.module'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { BatchDomainsModalComponent } from './batch-domains-modal.component'
import { BlocklistService } from './blocklist.service'
import { BulkService } from './bulk.service'
import { UserBanModalComponent } from './user-ban-modal.component'
import { UserModerationDropdownComponent } from './user-moderation-dropdown.component'
import { VideoAbuseService } from './video-abuse.service'
import { VideoBlockComponent } from './video-block.component'
import { VideoBlockService } from './video-block.service'
import { VideoReportComponent } from './video-report.component'

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
    BatchDomainsModalComponent
  ],

  exports: [
    UserBanModalComponent,
    UserModerationDropdownComponent,
    VideoBlockComponent,
    VideoReportComponent,
    BatchDomainsModalComponent
  ],

  providers: [
    BlocklistService,
    BulkService,
    VideoAbuseService,
    VideoBlockService
  ]
})
export class SharedModerationModule { }
