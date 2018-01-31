import { NgModule } from '@angular/core'

import { AboutRoutingModule } from './about-routing.module'
import { AboutComponent } from './about.component'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    AboutRoutingModule,
    SharedModule
  ],

  declarations: [
    AboutComponent
  ],

  exports: [
    AboutComponent
  ],

  providers: [
  ]
})
export class AboutModule { }
