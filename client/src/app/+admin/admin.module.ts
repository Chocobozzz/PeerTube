import { NgModule } from '@angular/core'
import { ConfigComponent, EditCustomConfigComponent } from '@app/+admin/config'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { TableModule } from 'primeng/table'
import { SharedModule } from '../shared'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import { FollowersListComponent, FollowingAddComponent, FollowsComponent, VideoRedundanciesListComponent } from './follows'
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
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'
import { JobsComponent } from '@app/+admin/system/jobs/jobs.component'
import { JobService, LogsComponent, LogsService, SystemComponent } from '@app/+admin/system'
import { DebugComponent, DebugService } from '@app/+admin/system/debug'
import { PluginsComponent } from '@app/+admin/plugins/plugins.component'
import { PluginListInstalledComponent } from '@app/+admin/plugins/plugin-list-installed/plugin-list-installed.component'
import { PluginSearchComponent } from '@app/+admin/plugins/plugin-search/plugin-search.component'
import { PluginShowInstalledComponent } from '@app/+admin/plugins/plugin-show-installed/plugin-show-installed.component'
import { SelectButtonModule } from 'primeng/selectbutton'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { VideoRedundancyInformationComponent } from '@app/+admin/follows/video-redundancies-list/video-redundancy-information.component'
import { ChartModule } from 'primeng/chart'

@NgModule({
  imports: [
    AdminRoutingModule,

    SharedModule,

    TableModule,
    SelectButtonModule,
    ChartModule
  ],

  declarations: [
    AdminComponent,

    FollowsComponent,
    FollowingAddComponent,
    FollowersListComponent,
    FollowingListComponent,
    RedundancyCheckboxComponent,
    VideoRedundanciesListComponent,
    VideoRedundancyInformationComponent,

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

    PluginsComponent,
    PluginListInstalledComponent,
    PluginSearchComponent,
    PluginShowInstalledComponent,

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
    JobService,
    LogsService,
    DebugService,
    ConfigService,
    PluginApiService
  ]
})
export class AdminModule { }
