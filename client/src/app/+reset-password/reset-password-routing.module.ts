import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { ResetPasswordComponent } from './reset-password.component'

const resetPasswordRoutes: Routes = [
  {
    path: '',
    component: ResetPasswordComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Reset password'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(resetPasswordRoutes) ],
  exports: [ RouterModule ]
})
export class ResetPasswordRoutingModule {}
