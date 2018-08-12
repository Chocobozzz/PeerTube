import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VerifyAccountEmailComponent } from '@app/+verify-account/verify-account-email/verify-account-email.component'
import { VerifyAccountAskEmailComponent } from '@app/+verify-account/verify-account-ask-email/verify-account-ask-email.component'

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
            title: 'Verify account email'
          }
        }
      },
      {
        path: 'ask-email',
        component: VerifyAccountAskEmailComponent,
        data: {
          meta: {
            title: 'Verify account ask email'
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
