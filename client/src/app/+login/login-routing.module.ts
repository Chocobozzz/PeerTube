import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { LoginComponent } from './login.component'
import { ServerConfigResolver } from '@app/core/routing/server-config-resolver.service'

const loginRoutes: Routes = [
  {
    path: '',
    component: LoginComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Login'
      }
    },
    resolve: {
      serverConfig: ServerConfigResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(loginRoutes) ],
  exports: [ RouterModule ]
})
export class LoginRoutingModule {}
