import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ServerConfigResolver, UnloggedGuard } from '@app/core'
import { RegisterComponent } from './register.component'

const registerRoutes: Routes = [
  {
    path: '',
    component: RegisterComponent,
    canActivate: [ UnloggedGuard ],
    data: {
      meta: {
        title: $localize`Register`
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
