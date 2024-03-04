import { Routes } from '@angular/router'
import { ServerConfigResolver } from '@app/core/routing/server-config-resolver.service'
import { LoginComponent } from './login.component'

export default [
  {
    path: '',
    component: LoginComponent,
    data: {
      meta: {
        title: $localize`Login`
      }
    },
    providers: [ ServerConfigResolver ],
    resolve: {
      serverConfig: ServerConfigResolver
    }
  }
] satisfies Routes
