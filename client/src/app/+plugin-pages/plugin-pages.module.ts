import { NgModule } from '@angular/core'
import { PluginPagesRoutingModule } from './plugin-pages-routing.module'
import { PluginPagesComponent } from './plugin-pages.component'

@NgModule({
  imports: [
    PluginPagesRoutingModule
  ],

  declarations: [
    PluginPagesComponent
  ],

  exports: [
    PluginPagesComponent
  ],

  providers: [
  ]
})
export class PluginPagesModule { }
