import { NgModule } from '@angular/core'
import { ConfigComponent, EditCustomConfigComponent } from '@app/+admin/config'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { TableModule } from 'primeng/table'
import { SharedModule } from '../shared'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import { FollowersListComponent, FollowingAddComponent, FollowsComponent, FollowService } from './follows'
import { FollowingListComponent } from './follows/following-list/following-list.component'
import { JobsComponent } from './jobs/job.component'
import { JobsListComponent } from './jobs/jobs-list/jobs-list.component'
import { JobService } from './jobs/shared/job.service'
import { UserCreateComponent, UserListComponent, UsersComponent, UserService, UserUpdateComponent } from './users'
import { ModerationCommentModalComponent, VideoAbuseListComponent, VideoBlacklistListComponent } from './moderation'
import { UserBanModalComponent } from '@app/+admin/users/user-list/user-ban-modal.component'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'
import { RedundancyCheckboxComponent } from '@app/+admin/follows/shared/redundancy-checkbox.component'
import { RedundancyService } from '@app/+admin/follows/shared/redundancy.service'

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
    UserListComponent,
    UserBanModalComponent,

    ModerationComponent,
    VideoBlacklistListComponent,
    VideoAbuseListComponent,
    ModerationCommentModalComponent,

    JobsComponent,
    JobsListComponent,

    ConfigComponent,
    EditCustomConfigComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    FollowService,
    RedundancyService,
    UserService,
    JobService,
    ConfigService
  ]
})
export class AdminModule { }
