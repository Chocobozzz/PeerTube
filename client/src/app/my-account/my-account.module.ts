import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { MyAccountRoutingModule } from './my-account-routing.module'
import { MyAccountChangePasswordComponent } from './my-account-settings/my-account-change-password/my-account-change-password.component'
import { MyAccountDetailsComponent } from './my-account-settings/my-account-details/my-account-details.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountComponent } from './my-account.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'

@NgModule({
  imports: [
    MyAccountRoutingModule,
    SharedModule
  ],

  declarations: [
    MyAccountComponent,
    MyAccountSettingsComponent,
    MyAccountChangePasswordComponent,
    MyAccountDetailsComponent,
    MyAccountVideosComponent
  ],

  exports: [
    MyAccountComponent
  ],

  providers: []
})
export class MyAccountModule { }
