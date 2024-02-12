import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { SharedPluginPagesComponent } from '@app/shared/shared-plugin-pages/plugin-pages.component'

const pluginPagesRoutes: Routes = [
  {
    path: '**',
    component: SharedPluginPagesComponent,
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
