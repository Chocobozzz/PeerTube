import { Routes } from '@angular/router'
import { SharedPluginPagesComponent } from './plugin-pages.component'

export default [
  {
    path: '**',
    component: SharedPluginPagesComponent,
    data: {
      reloadOnSameNavigation: true
    }
  }
] satisfies Routes
