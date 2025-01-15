import { Routes } from '@angular/router'
import { ErrorPageComponent } from './error-page.component'

export default [
  {
    path: '',
    component: ErrorPageComponent,
    data: {
      meta: {
        title: $localize`Not found`
      }
    }
  }
] satisfies Routes
