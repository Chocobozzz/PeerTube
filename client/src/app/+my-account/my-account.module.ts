import { AutoCompleteModule } from 'primeng/autocomplete'
import { InputSwitchModule } from 'primeng/inputswitch'
import { TableModule } from 'primeng/table'
import { DragDropModule } from '@angular/cdk/drag-drop'
import { NgModule } from '@angular/core'
import { SharedAbuseListModule } from '@app/shared/shared-abuse-list'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedShareModal } from '@app/shared/shared-share-modal'
import { SharedUserInterfaceSettingsModule } from '@app/shared/shared-user-settings'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription/shared-user-subscription.module'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist/shared-video-playlist.module'
import { MyAccountAbusesListComponent } from './my-account-abuses/my-account-abuses-list.component'
import { MyAccountBlocklistComponent } from './my-account-blocklist/my-account-blocklist.component'
import { MyAccountServerBlocklistComponent } from './my-account-blocklist/my-account-server-blocklist.component'
import { MyAccountHistoryComponent } from './my-account-history/my-account-history.component'
import { MyAccountNotificationsComponent } from './my-account-notifications/my-account-notifications.component'
import { MyAccountAcceptOwnershipComponent } from './my-account-ownership/my-account-accept-ownership/my-account-accept-ownership.component'
import { MyAccountOwnershipComponent } from './my-account-ownership/my-account-ownership.component'
import { MyAccountRoutingModule } from './my-account-routing.module'
import { MyAccountChangeEmailComponent } from './my-account-settings/my-account-change-email'
import { MyAccountChangePasswordComponent } from './my-account-settings/my-account-change-password/my-account-change-password.component'
import { MyAccountDangerZoneComponent } from './my-account-settings/my-account-danger-zone'
import { MyAccountNotificationPreferencesComponent } from './my-account-settings/my-account-notification-preferences'
import { MyAccountProfileComponent } from './my-account-settings/my-account-profile/my-account-profile.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountSubscriptionsComponent } from './my-account-subscriptions/my-account-subscriptions.component'
import { MyAccountVideoImportsComponent } from './my-account-video-imports/my-account-video-imports.component'
import { MyAccountVideoPlaylistCreateComponent } from './my-account-video-playlists/my-account-video-playlist-create.component'
import { MyAccountVideoPlaylistElementsComponent } from './my-account-video-playlists/my-account-video-playlist-elements.component'
import { MyAccountVideoPlaylistUpdateComponent } from './my-account-video-playlists/my-account-video-playlist-update.component'
import { MyAccountVideoPlaylistsComponent } from './my-account-video-playlists/my-account-video-playlists.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'
import { VideoChangeOwnershipComponent } from './my-account-videos/video-change-ownership/video-change-ownership.component'
import { MyAccountComponent } from './my-account.component'

@NgModule({
  imports: [
    MyAccountRoutingModule,

    AutoCompleteModule,
    TableModule,
    InputSwitchModule,
    DragDropModule,

    SharedMainModule,
    SharedFormModule,
    SharedModerationModule,
    SharedVideoMiniatureModule,
    SharedUserSubscriptionModule,
    SharedVideoPlaylistModule,
    SharedUserInterfaceSettingsModule,
    SharedGlobalIconModule,
    SharedAbuseListModule,
    SharedShareModal
  ],

  declarations: [
    MyAccountComponent,
    MyAccountSettingsComponent,
    MyAccountChangePasswordComponent,
    MyAccountProfileComponent,
    MyAccountChangeEmailComponent,

    MyAccountVideosComponent,

    VideoChangeOwnershipComponent,
    MyAccountOwnershipComponent,
    MyAccountAcceptOwnershipComponent,
    MyAccountVideoImportsComponent,
    MyAccountDangerZoneComponent,
    MyAccountSubscriptionsComponent,
    MyAccountBlocklistComponent,
    MyAccountAbusesListComponent,
    MyAccountServerBlocklistComponent,
    MyAccountHistoryComponent,
    MyAccountNotificationsComponent,
    MyAccountNotificationPreferencesComponent,

    MyAccountVideoPlaylistCreateComponent,
    MyAccountVideoPlaylistUpdateComponent,
    MyAccountVideoPlaylistsComponent,
    MyAccountVideoPlaylistElementsComponent
  ],

  exports: [
    MyAccountComponent
  ],

  providers: []
})
export class MyAccountModule {
}
