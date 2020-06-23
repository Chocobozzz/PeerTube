import { NgModule } from '@angular/core'
import { AboutFollowsComponent } from '@app/+about/about-follows/about-follows.component'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutInstanceResolver } from '@app/+about/about-instance/about-instance.resolver'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { AboutPeertubeContributorsComponent } from '@app/+about/about-peertube/about-peertube-contributors.component'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedInstanceModule } from '@app/shared/shared-instance'
import { SharedMainModule } from '@app/shared/shared-main'
import { AboutRoutingModule } from './about-routing.module'
import { AboutComponent } from './about.component'

@NgModule({
  imports: [
    AboutRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedInstanceModule,
    SharedGlobalIconModule
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
