import { TableModule } from 'primeng/table'
import { NgModule } from '@angular/core'
import { AutoCompleteModule } from 'primeng/autocomplete'
import { SharedModule } from '../shared'
import { MyAccountRoutingModule } from './my-account-routing.module'
import { MyAccountChangePasswordComponent } from './my-account-settings/my-account-change-password/my-account-change-password.component'
import { MyAccountVideoSettingsComponent } from './my-account-settings/my-account-video-settings/my-account-video-settings.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountComponent } from './my-account.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'
import { VideoChangeOwnershipComponent } from './my-account-videos/video-change-ownership/video-change-ownership.component'
import { MyAccountOwnershipComponent } from './my-account-ownership/my-account-ownership.component'
import { MyAccountAcceptOwnershipComponent } from './my-account-ownership/my-account-accept-ownership/my-account-accept-ownership.component'
import { MyAccountProfileComponent } from '@app/+my-account/my-account-settings/my-account-profile/my-account-profile.component'
import { MyAccountVideoChannelsComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channels.component'
import { MyAccountVideoChannelCreateComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channel-create.component'
import { MyAccountVideoChannelUpdateComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channel-update.component'
import { ActorAvatarInfoComponent } from '@app/+my-account/shared/actor-avatar-info.component'
import { MyAccountVideoImportsComponent } from '@app/+my-account/my-account-video-imports/my-account-video-imports.component'
import { MyAccountDangerZoneComponent } from '@app/+my-account/my-account-settings/my-account-danger-zone'
import { MyAccountSubscriptionsComponent } from '@app/+my-account/my-account-subscriptions/my-account-subscriptions.component'
import { MyAccountBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-blocklist.component'
import { MyAccountServerBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-server-blocklist.component'

@NgModule({
  imports: [
    TableModule,
    MyAccountRoutingModule,
    AutoCompleteModule,
    SharedModule,
    TableModule
  ],

  declarations: [
    MyAccountComponent,
    MyAccountSettingsComponent,
    MyAccountChangePasswordComponent,
    MyAccountVideoSettingsComponent,
    MyAccountProfileComponent,
    MyAccountVideosComponent,
    VideoChangeOwnershipComponent,
    MyAccountOwnershipComponent,
    MyAccountAcceptOwnershipComponent,
    MyAccountVideoChannelsComponent,
    MyAccountVideoChannelCreateComponent,
    MyAccountVideoChannelUpdateComponent,
    ActorAvatarInfoComponent,
    MyAccountVideoImportsComponent,
    MyAccountDangerZoneComponent,
    MyAccountSubscriptionsComponent,
    MyAccountBlocklistComponent,
    MyAccountServerBlocklistComponent
  ],

  exports: [
    MyAccountComponent
  ],

  providers: []
})
export class MyAccountModule { }
