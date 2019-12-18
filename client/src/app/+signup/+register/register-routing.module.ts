import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { RegisterComponent } from './register.component'
import { ServerConfigResolver } from '@app/core/routing/server-config-resolver.service'
import { UnloggedGuard } from '@app/core/routing/unlogged-guard.service'

const registerRoutes: Routes = [
  {
    path: '',
    component: RegisterComponent,
    canActivate: [ MetaGuard, UnloggedGuard ],
    data: {
      meta: {
        title: 'Register'
      }
    },
    resolve: {
      serverConfig: ServerConfigResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(registerRoutes) ],
  exports: [ RouterModule ]
})
export class RegisterRoutingModule {}
