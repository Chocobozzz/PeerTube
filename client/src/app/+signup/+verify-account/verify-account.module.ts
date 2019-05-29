import { NgModule } from '@angular/core'
import { VerifyAccountRoutingModule } from './verify-account-routing.module'
import { VerifyAccountEmailComponent } from './verify-account-email/verify-account-email.component'
import { VerifyAccountAskSendEmailComponent } from './verify-account-ask-send-email/verify-account-ask-send-email.component'
import { SharedModule } from '@app/shared'
import { SignupSharedModule } from '@app/+signup/shared/signup-shared.module'

@NgModule({
  imports: [
    VerifyAccountRoutingModule,
    SharedModule,
    SignupSharedModule
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
