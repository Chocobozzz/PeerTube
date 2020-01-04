import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VerifyAccountEmailComponent } from './verify-account-email/verify-account-email.component'
import { VerifyAccountAskSendEmailComponent } from './verify-account-ask-send-email/verify-account-ask-send-email.component'
import { PrivateGuard } from '../../core/routing/private-guard.service'

const verifyAccountRoutes: Routes = [
  {
    path: '',
    canActivateChild: [ MetaGuard, PrivateGuard ],
    children: [
      {
        path: 'email',
        component: VerifyAccountEmailComponent,
        data: {
          meta: {
            title: 'Verify account email'
          }
        }
      },
      {
        path: 'ask-send-email',
        component: VerifyAccountAskSendEmailComponent,
        data: {
          meta: {
            title: 'Verify account ask send email'
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
