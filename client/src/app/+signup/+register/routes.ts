import { Routes } from '@angular/router'
import { ServerConfigResolver, UnloggedGuard } from '@app/core'
import { RegisterComponent } from './register.component'
import { SignupService } from '../shared/signup.service'

export default [
  {
    path: '',
    component: RegisterComponent,
    canActivate: [ UnloggedGuard ],
    data: {
      meta: {
        title: $localize`Register`
      }
    },
    providers: [ ServerConfigResolver, SignupService ],
    resolve: {
      serverConfig: ServerConfigResolver
    }
  }
] satisfies Routes
