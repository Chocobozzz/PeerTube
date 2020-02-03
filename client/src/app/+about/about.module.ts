import { NgModule } from '@angular/core'
import { AboutRoutingModule } from './about-routing.module'
import { AboutComponent } from './about.component'
import { SharedModule } from '../shared'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { AboutFollowsComponent } from '@app/+about/about-follows/about-follows.component'
import { AboutPeertubeContributorsComponent } from '@app/+about/about-peertube/about-peertube-contributors.component'
import { AboutInstanceResolver } from '@app/+about/about-instance/about-instance.resolver'

@NgModule({
  imports: [
    AboutRoutingModule,
    SharedModule
  ],

  declarations: [
    AboutComponent,
    AboutInstanceComponent,
    AboutPeertubeComponent,
    AboutFollowsComponent,
    AboutPeertubeContributorsComponent,
    ContactAdminModalComponent
  ],

  exports: [
    AboutComponent
  ],

  providers: [
    AboutInstanceResolver
  ]
})
export class AboutModule { }
