import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VerifyAccountEmailComponent } from './verify-account-email/verify-account-email.component'
import { VerifyAccountAskSendEmailComponent } from './verify-account-ask-send-email/verify-account-ask-send-email.component'

const verifyAccountRoutes: Routes = [
  {
    path: '',
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: 'email',
        component: VerifyAccountEmailComponent,
        data: {
          meta: {
            title: $localize`Verify account via email`
          }
        }
      },
      {
        path: 'ask-send-email',
        component: VerifyAccountAskSendEmailComponent,
        data: {
          meta: {
            title: $localize`Ask to send an email to verify you account`
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(verifyAccountRoutes) ],
  exports: [ RouterModule ]
})
export class VerifyAccountRoutingModule {}
