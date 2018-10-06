import { NgModule } from '@angular/core'

import { VerifyAccountRoutingModule } from '@app/+verify-account/verify-account-routing.module'
import { VerifyAccountEmailComponent } from '@app/+verify-account/verify-account-email/verify-account-email.component'
import {
  VerifyAccountAskSendEmailComponent
} from '@app/+verify-account/verify-account-ask-send-email/verify-account-ask-send-email.component'
import { SharedModule } from '@app/shared'

@NgModule({
  imports: [
    VerifyAccountRoutingModule,
    SharedModule
  ],

  declarations: [
    VerifyAccountEmailComponent,
    VerifyAccountAskSendEmailComponent
  ],

  exports: [
  ],

  providers: [
  ]
})
export class VerifyAccountModule { }
