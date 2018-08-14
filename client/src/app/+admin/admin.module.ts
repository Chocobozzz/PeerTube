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
import { ModerationCommentModalComponent, VideoAbuseListComponent, VideoAbusesComponent } from './video-abuses'
import { VideoBlacklistComponent, VideoBlacklistListComponent } from './video-blacklist'
import { UserBanModalComponent } from '@app/+admin/users/user-list/user-ban-modal.component'

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

    UsersComponent,
    UserCreateComponent,
    UserUpdateComponent,
    UserListComponent,
    UserBanModalComponent,

    VideoBlacklistComponent,
    VideoBlacklistListComponent,

    VideoAbusesComponent,
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
    UserService,
    JobService,
    ConfigService
  ]
})
export class AdminModule { }
