import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ResetPasswordComponent } from './reset-password.component'

const resetPasswordRoutes: Routes = [
  {
    path: '',
    component: ResetPasswordComponent,
    data: {
      meta: {
        title: $localize`Reset password`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(resetPasswordRoutes) ],
  exports: [ RouterModule ]
})
export class ResetPasswordRoutingModule {}
