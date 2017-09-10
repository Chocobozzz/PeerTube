import { NgModule } from '@angular/core'

import { AdminComponent } from './admin.component'
import { AdminRoutingModule } from './admin-routing.module'
import { FriendsComponent, FriendAddComponent, FriendListComponent, FriendService } from './friends'
import { RequestSchedulersComponent, RequestSchedulersStatsComponent, RequestSchedulersService } from './request-schedulers'
import { UsersComponent, UserAddComponent, UserUpdateComponent, UserListComponent, UserService } from './users'
import { VideoAbusesComponent, VideoAbuseListComponent } from './video-abuses'
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
    AdminGuard
  ]
})
export class AdminModule { }
