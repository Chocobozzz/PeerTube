import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { AccountRoutingModule } from './account-routing.module'
import { AccountChangePasswordComponent } from './account-settings/account-change-password/account-change-password.component'
import { AccountDetailsComponent } from './account-settings/account-details/account-details.component'
import { AccountSettingsComponent } from './account-settings/account-settings.component'
import { AccountComponent } from './account.component'
import { AccountService } from './account.service'
import { AccountVideosComponent } from './account-videos/account-videos.component'

@NgModule({
  imports: [
    AccountRoutingModule,
    SharedModule
  ],

  declarations: [
    AccountComponent,
    AccountSettingsComponent,
    AccountChangePasswordComponent,
    AccountDetailsComponent,
    AccountVideosComponent
  ],

  exports: [
    AccountComponent
  ],

  providers: []
})
export class AccountModule { }
