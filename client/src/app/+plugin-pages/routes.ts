import { Routes } from '@angular/router'
import { PluginPagesComponent } from './plugin-pages.component'

export default [
  {
    path: '**',
    component: PluginPagesComponent,
    data: {
      reloadOnSameNavigation: true
    }
  }
] satisfies Routes
