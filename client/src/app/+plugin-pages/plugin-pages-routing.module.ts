import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PluginPagesComponent } from './plugin-pages.component'

const pluginPagesRoutes: Routes = [
  {
    path: '**',
    component: PluginPagesComponent,
    data: {
      reloadOnSameNavigation: true
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(pluginPagesRoutes) ],
  exports: [ RouterModule ]
})
export class PluginPagesRoutingModule {}
