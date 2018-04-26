import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { MyAccountRoutingModule } from './my-account-routing.module'
import { MyAccountChangePasswordComponent } from './my-account-settings/my-account-change-password/my-account-change-password.component'
import { MyAccountVideoSettingsComponent } from './my-account-settings/my-account-video-settings/my-account-video-settings.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountComponent } from './my-account.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'
import { MyAccountProfileComponent } from '@app/my-account/my-account-settings/my-account-profile/my-account-profile.component'

@NgModule({
  imports: [
    MyAccountRoutingModule,
    SharedModule
  ],

  declarations: [
    MyAccountComponent,
    MyAccountSettingsComponent,
    MyAccountChangePasswordComponent,
    MyAccountVideoSettingsComponent,
    MyAccountProfileComponent,
    MyAccountVideosComponent
  ],

  exports: [
    MyAccountComponent
  ],

  providers: []
})
export class MyAccountModule { }
