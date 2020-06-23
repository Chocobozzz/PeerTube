import { ChartModule } from 'primeng/chart'
import { SelectButtonModule } from 'primeng/selectbutton'
import { TableModule } from 'primeng/table'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import { ConfigComponent, EditCustomConfigComponent } from './config'
import { ConfigService } from './config/shared/config.service'
import { FollowersListComponent, FollowsComponent, VideoRedundanciesListComponent } from './follows'
import { FollowingListComponent } from './follows/following-list/following-list.component'
import { RedundancyCheckboxComponent } from './follows/shared/redundancy-checkbox.component'
import { VideoRedundancyInformationComponent } from './follows/video-redundancies-list/video-redundancy-information.component'
import { ModerationCommentModalComponent, VideoAbuseListComponent, VideoBlockListComponent } from './moderation'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from './moderation/instance-blocklist'
import { ModerationComponent } from './moderation/moderation.component'
import { VideoAbuseDetailsComponent } from './moderation/video-abuse-list/video-abuse-details.component'
import { PluginListInstalledComponent } from './plugins/plugin-list-installed/plugin-list-installed.component'
import { PluginSearchComponent } from './plugins/plugin-search/plugin-search.component'
import { PluginShowInstalledComponent } from './plugins/plugin-show-installed/plugin-show-installed.component'
import { PluginsComponent } from './plugins/plugins.component'
import { PluginApiService } from './plugins/shared/plugin-api.service'
import { JobService, LogsComponent, LogsService, SystemComponent } from './system'
import { DebugComponent, DebugService } from './system/debug'
import { JobsComponent } from './system/jobs/jobs.component'
import { UserCreateComponent, UserListComponent, UserPasswordComponent, UsersComponent, UserUpdateComponent } from './users'

@NgModule({
  imports: [
    AdminRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedModerationModule,
    SharedGlobalIconModule,

    TableModule,
    SelectButtonModule,
    ChartModule
  ],

  declarations: [
    AdminComponent,

    FollowsComponent,
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
    VideoBlockListComponent,
    VideoAbuseListComponent,
    VideoAbuseDetailsComponent,
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
