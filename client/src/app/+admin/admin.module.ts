import { NgModule } from '@angular/core'

import { AdminComponent } from './admin.component'
import { AdminRoutingModule } from './admin-routing.module'
import { FriendsComponent, FriendAddComponent, FriendListComponent, FriendService } from './friends'
import { UsersComponent, UserAddComponent, UserUpdateComponent, UserListComponent, UserService } from './users'
import { VideoAbusesComponent, VideoAbuseListComponent } from './video-abuses'
import { VideoBlacklistComponent, VideoBlacklistListComponent } from './video-blacklist'
import { SharedModule } from '../shared'

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

    UsersComponent,
    UserAddComponent,
    UserUpdateComponent,
    UserListComponent,

    VideoBlacklistComponent,
    VideoBlacklistListComponent,

    VideoAbusesComponent,
    VideoAbuseListComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    FriendService,
    UserService
  ]
})
export class AdminModule { }
