import { NgModule } from '@angular/core'

import { VerifyAccountRoutingModule } from '@app/+verify-account/verify-account-routing.module'
import { VerifyAccountEmailComponent } from '@app/+verify-account/verify-account-email/verify-account-email.component'
import { VerifyAccountAskEmailComponent } from '@app/+verify-account/verify-account-ask-email/verify-account-ask-email.component'
import { SharedModule } from '@app/shared'

@NgModule({
  imports: [
    VerifyAccountRoutingModule,
    SharedModule
  ],

  declarations: [
    VerifyAccountEmailComponent,
    VerifyAccountAskEmailComponent
  ],

  exports: [
  ],

  providers: [
  ]
})
export class VerifyAccountModule { }
