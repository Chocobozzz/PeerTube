import { NgModule } from '@angular/core'
import { SharedSignupModule } from '../shared/shared-signup.module'
import { VerifyAccountAskSendEmailComponent } from './verify-account-ask-send-email/verify-account-ask-send-email.component'
import { VerifyAccountEmailComponent } from './verify-account-email/verify-account-email.component'
import { VerifyAccountRoutingModule } from './verify-account-routing.module'

@NgModule({
  imports: [
    VerifyAccountRoutingModule,

    SharedSignupModule
  ],

  declarations: [
    VerifyAccountEmailComponent,
    VerifyAccountAskSendEmailComponent
  ],

  exports: [],

  providers: []
})
export class VerifyAccountModule {
}
