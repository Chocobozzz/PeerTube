import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginComponent } from './login.component'

const loginRoutes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Login'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(loginRoutes) ],
  exports: [ RouterModule ]
})
export class LoginRoutingModule {}
