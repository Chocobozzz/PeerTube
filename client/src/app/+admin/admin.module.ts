import { NgModule } from '@angular/core'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { SharedModule } from '../shared'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import { FollowersListComponent, FollowingAddComponent, FollowsComponent, FollowService } from './follows'
import { FollowingListComponent } from './follows/following-list/following-list.component'
import { JobsComponent } from './jobs/job.component'
import { JobsListComponent } from './jobs/jobs-list/jobs-list.component'
import { JobService } from './jobs/shared/job.service'
import { UserAddComponent, UserListComponent, UsersComponent, UserService, UserUpdateComponent } from './users'
import { VideoAbuseListComponent, VideoAbusesComponent } from './video-abuses'
import { VideoBlacklistComponent, VideoBlacklistListComponent } from './video-blacklist'

@NgModule({
  imports: [
    AdminRoutingModule,
    TabsModule.forRoot(),
    SharedModule
  ],

  declarations: [
    AdminComponent,

    FollowsComponent,
    FollowingAddComponent,
    FollowersListComponent,
    FollowingListComponent,

    UsersComponent,
    UserAddComponent,
    UserUpdateComponent,
    UserListComponent,

    VideoBlacklistComponent,
    VideoBlacklistListComponent,

    VideoAbusesComponent,
    VideoAbuseListComponent,

    JobsComponent,
    JobsListComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    FollowService,
    UserService,
    JobService
  ]
})
export class AdminModule { }
