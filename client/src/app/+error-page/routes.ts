import { Routes } from '@angular/router'
import { ErrorPageComponent } from './error-page.component'
import { MenuGuards } from '@app/core'

export default [
  {
    path: '',
    component: ErrorPageComponent,
    canActivate: [ MenuGuards.close(true) ],
    canDeactivate: [ MenuGuards.open(true) ],
    data: {
      meta: {
        title: $localize`Not found`
      }
    }
  }
] satisfies Routes
