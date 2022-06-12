import { ChartModule } from 'primeng/chart'
import { SelectButtonModule } from 'primeng/selectbutton'
import { TableModule } from 'primeng/table'
import { NgModule } from '@angular/core'
import { SharedAbuseListModule } from '@app/shared/shared-abuse-list'
import { SharedActorImageEditModule } from '@app/shared/shared-actor-image-edit'
import { SharedActorImageModule } from '@app/shared/shared-actor-image/shared-actor-image.module'
import { SharedCustomMarkupModule } from '@app/shared/shared-custom-markup'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedTablesModule } from '@app/shared/shared-tables'
import { SharedVideoCommentModule } from '@app/shared/shared-video-comment'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { AdminRoutingModule } from './admin-routing.module'
import { AdminComponent } from './admin.component'
import {
  EditAdvancedConfigurationComponent,
  EditBasicConfigurationComponent,
  EditConfigurationService,
  EditCustomConfigComponent,
  EditHomepageComponent,
  EditInstanceInformationComponent,
  EditLiveConfigurationComponent,
  EditVODTranscodingComponent
} from './config'
import { ConfigService } from './config/shared/config.service'
import { FollowersListComponent, FollowModalComponent, VideoRedundanciesListComponent } from './follows'
import { FollowingListComponent } from './follows/following-list/following-list.component'
import { RedundancyCheckboxComponent } from './follows/shared/redundancy-checkbox.component'
import { VideoRedundancyInformationComponent } from './follows/video-redundancies-list/video-redundancy-information.component'
import { AbuseListComponent, VideoBlockListComponent } from './moderation'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from './moderation/instance-blocklist'
import { VideoCommentListComponent } from './moderation/video-comment-list'
import {
  UserCreateComponent,
  UserListComponent,
  UserPasswordComponent,
  UserUpdateComponent,
  VideoAdminService,
  VideoListComponent
} from './overview'
import { PluginListInstalledComponent } from './plugins/plugin-list-installed/plugin-list-installed.component'
import { PluginSearchComponent } from './plugins/plugin-search/plugin-search.component'
import { PluginShowInstalledComponent } from './plugins/plugin-show-installed/plugin-show-installed.component'
import { PluginsComponent } from './plugins/plugins.component'
import { PluginApiService } from './plugins/shared/plugin-api.service'
import { JobService, LogsComponent, LogsService } from './system'
import { DebugComponent, DebugService } from './system/debug'
import { JobsComponent } from './system/jobs/jobs.component'

@NgModule({
  imports: [
    AdminRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedModerationModule,
    SharedGlobalIconModule,
    SharedAbuseListModule,
    SharedVideoCommentModule,
    SharedActorImageModule,
    SharedActorImageEditModule,
    SharedCustomMarkupModule,
    SharedVideoMiniatureModule,
    SharedTablesModule,

    TableModule,
    SelectButtonModule,
    ChartModule
  ],

  declarations: [
    AdminComponent,

    VideoListComponent,

    FollowersListComponent,
    FollowingListComponent,
    FollowModalComponent,
    RedundancyCheckboxComponent,
    VideoRedundanciesListComponent,
    VideoRedundancyInformationComponent,

    UserCreateComponent,
    UserUpdateComponent,
    UserPasswordComponent,
    UserListComponent,

    VideoBlockListComponent,
    AbuseListComponent,
    VideoCommentListComponent,

    InstanceServerBlocklistComponent,
    InstanceAccountBlocklistComponent,

    PluginsComponent,
    PluginListInstalledComponent,
    PluginSearchComponent,
    PluginShowInstalledComponent,

    JobsComponent,
    LogsComponent,
    DebugComponent,

    EditCustomConfigComponent,
    EditBasicConfigurationComponent,
    EditVODTranscodingComponent,
    EditLiveConfigurationComponent,
    EditAdvancedConfigurationComponent,
    EditInstanceInformationComponent,
    EditHomepageComponent
  ],

  exports: [
    AdminComponent
  ],

  providers: [
    JobService,
    LogsService,
    DebugService,
    ConfigService,
    PluginApiService,
    EditConfigurationService,
    VideoAdminService
  ]
})
export class AdminModule { }
