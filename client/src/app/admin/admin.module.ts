import { NgModule } from '@angular/core';

import { AdminComponent } from './admin.component';
import { AdminRoutingModule } from './admin-routing.module';
import { FriendsComponent, FriendAddComponent, FriendListComponent, FriendService } from './friends';
import { RequestsComponent, RequestStatsComponent, RequestService } from './requests';
import { UsersComponent, UserAddComponent, UserListComponent, UserService } from './users';
import { VideoAbusesComponent, VideoAbuseListComponent } from './video-abuses';
import { MenuAdminComponent } from './menu-admin.component';
import { SharedModule } from '../shared';

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

    RequestsComponent,
    RequestStatsComponent,

    UsersComponent,
    UserAddComponent,
    UserListComponent,

    VideoAbusesComponent,
    VideoAbuseListComponent,

    MenuAdminComponent
  ],

  exports: [
    AdminComponent,
    MenuAdminComponent
  ],

  providers: [
    FriendService,
    RequestService,
    UserService
  ]
})
export class AdminModule { }
