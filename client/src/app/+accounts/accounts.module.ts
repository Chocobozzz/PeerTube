import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { AccountAboutComponent } from './account-about/account-about.component'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountsRoutingModule } from './accounts-routing.module'
import { AccountsComponent } from './accounts.component'

@NgModule({
  imports: [
    AccountsRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedUserSubscriptionModule,
    SharedModerationModule,
    SharedVideoMiniatureModule,
    SharedGlobalIconModule
  ],

  declarations: [
    AccountsComponent,
    AccountVideosComponent,
    AccountVideoChannelsComponent,
    AccountAboutComponent
  ],

  exports: [
    AccountsComponent
  ],

  providers: []
})
export class AccountsModule { }
