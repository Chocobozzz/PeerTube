import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { SignupComponent } from './signup.component'
import { ServerConfigResolver } from '@app/core/routing/server-config-resolver.service'

const signupRoutes: Routes = [
  {
    path: 'signup',
    component: SignupComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Signup'
      }
    },
    resolve: {
      serverConfigLoaded: ServerConfigResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(signupRoutes) ],
  exports: [ RouterModule ]
})
export class SignupRoutingModule {}
