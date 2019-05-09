import { NgModule } from '@angular/core'

import { AboutRoutingModule } from './about-routing.module'
import { AboutComponent } from './about.component'
import { SharedModule } from '../shared'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'

@NgModule({
  imports: [
    AboutRoutingModule,
    SharedModule
  ],

  declarations: [
    AboutComponent,
    AboutInstanceComponent,
    AboutPeertubeComponent,
    ContactAdminModalComponent
  ],

  exports: [
    AboutComponent
  ],

  providers: [
  ]
})
export class AboutModule { }
