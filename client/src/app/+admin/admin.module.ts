import { NgModule } from '@angular/core'
import { ConfigComponent, EditCustomConfigComponent } from '@app/+admin/config'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { TableModule } from 'primeng/table'
import { SharedModule } from '../shared'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import { FollowersListComponent, FollowingAddComponent, FollowsComponent, FollowService } from './follows'
import { FollowingListComponent } from './follows/following-list/following-list.component'
import { UserCreateComponent, UserListComponent, UserPasswordComponent, UsersComponent, UserUpdateComponent } from './users'
import {
  ModerationCommentModalComponent,
  VideoAbuseListComponent,
  VideoAutoBlacklistListComponent,
  VideoBlacklistListComponent
} from './moderation'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'
import { RedundancyCheckboxComponent } from '@app/+admin/follows/shared/redundancy-checkbox.component'
import { RedundancyService } from '@app/+admin/follows/shared/redundancy.service'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'
import { JobsComponent } from '@app/+admin/system/jobs/jobs.component'
import { JobService, LogsComponent, LogsService, SystemComponent } from '@app/+admin/system'
import { DebugComponent, DebugService } from '@app/+admin/system/debug'

@NgModule({
  imports: [
    AdminRoutingModule,
    TableModule,
    SharedModule
  ],

  declarations: [
    AdminComponent,

    FollowsComponent,
    FollowingAddComponent,
    FollowersListComponent,
    FollowingListComponent,
    RedundancyCheckboxComponent,

    UsersComponent,
    UserCreateComponent,
    UserUpdateComponent,
    UserPasswordComponent,
    UserListComponent,

    ModerationComponent,
    VideoBlacklistListComponent,
    VideoAbuseListComponent,
    VideoAutoBlacklistListComponent,
    ModerationCommentModalComponent,
    InstanceServerBlocklistComponent,
    InstanceAccountBlocklistComponent,

    SystemComponent,
    JobsComponent,
    LogsComponent,
    DebugComponent,

    ConfigComponent,
    EditCustomConfigComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    FollowService,
    RedundancyService,
    JobService,
    LogsService,
    DebugService,
    ConfigService
  ]
})
export class AdminModule { }
