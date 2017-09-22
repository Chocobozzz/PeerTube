import { NgModule } from '@angular/core'

import { AdminComponent } from './admin.component'
import { AdminRoutingModule } from './admin-routing.module'
import { FriendsComponent, FriendAddComponent, FriendListComponent, FriendService } from './friends'
import { RequestSchedulersComponent, RequestSchedulersStatsComponent, RequestSchedulersService } from './request-schedulers'
import { UsersComponent, UserAddComponent, UserUpdateComponent, UserListComponent, UserService } from './users'
import { VideoAbusesComponent, VideoAbuseListComponent } from './video-abuses'
import { BlacklistComponent, BlacklistListComponent, BlacklistService } from './blacklist'
import { SharedModule } from '../shared'
import { AdminGuard } from './admin-guard.service'

@NgModule({
  imports: [
    AdminRoutingModule,
    SharedModule
  ],

  declarations: [
    AdminComponent,

    FriendsComponent,
    FriendAddComponent,
    FriendListComponent,

    RequestSchedulersComponent,
    RequestSchedulersStatsComponent,

    UsersComponent,
    UserAddComponent,
    UserUpdateComponent,
    UserListComponent,

    BlacklistComponent,
    BlacklistListComponent,

    VideoAbusesComponent,
    VideoAbuseListComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    FriendService,
    RequestSchedulersService,
    UserService,
    AdminGuard,
    BlacklistService
  ]
})
export class AdminModule { }
