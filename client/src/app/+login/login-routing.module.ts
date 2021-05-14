import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ServerConfigResolver } from '@app/core/routing/server-config-resolver.service'
import { LoginComponent } from './login.component'

const loginRoutes: Routes = [
  {
    path: '',
    component: LoginComponent,
    data: {
      meta: {
        title: $localize`Login`
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
