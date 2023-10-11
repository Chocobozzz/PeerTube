import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '../shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from '../shared-forms/shared-form.module'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { SharedUsersModule } from '../shared-users'
import { SharedVideoCommentModule } from '../shared-video-comment'
import { AbuseService } from './abuse.service'
import { AccountBlockBadgesComponent } from './account-block-badges.component'
import { BatchDomainsModalComponent } from './batch-domains-modal.component'
import { BlocklistService } from './blocklist.service'
import { BulkService } from './bulk.service'
import { AccountReportComponent, CommentReportComponent, VideoReportComponent } from './report-modals'
import { UserBanModalComponent } from './user-ban-modal.component'
import { UserModerationDropdownComponent } from './user-moderation-dropdown.component'
import { VideoBlockComponent } from './video-block.component'
import { VideoBlockService } from './video-block.service'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedVideoCommentModule,
    SharedActorImageModule,
    SharedUsersModule
  ],

  declarations: [
    UserBanModalComponent,
    UserModerationDropdownComponent,
    VideoBlockComponent,
    VideoReportComponent,
    BatchDomainsModalComponent,
    CommentReportComponent,
    AccountReportComponent,
    AccountBlockBadgesComponent
  ],

  exports: [
    UserBanModalComponent,
    UserModerationDropdownComponent,
    VideoBlockComponent,
    VideoReportComponent,
    BatchDomainsModalComponent,
    CommentReportComponent,
    AccountReportComponent,
    AccountBlockBadgesComponent
  ],

  providers: [
    BlocklistService,
    BulkService,
    AbuseService,
    VideoBlockService
  ]
})
export class SharedModerationModule { }
