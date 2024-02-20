import { SharedPluginPagesModule } from './../shared/shared-plugin-pages/shared-plugin-pages.module'
import { NgModule } from '@angular/core'
import { PluginPagesRoutingModule } from './plugin-pages-routing.module'

@NgModule({
  imports: [
    PluginPagesRoutingModule,
    SharedPluginPagesModule
  ],

  providers: [
  ]
})
export class PluginPagesModule { }
