import { NgModule } from '@angular/core'
import { AboutFollowsComponent } from '@app/+about/about-follows/about-follows.component'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutInstanceResolver } from '@app/+about/about-instance/about-instance.resolver'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { InstanceStatisticsComponent } from '@app/+about/about-instance/instance-statistics.component'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { SharedCustomMarkupModule } from '@app/shared/shared-custom-markup'
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
    SharedGlobalIconModule,
    SharedCustomMarkupModule
  ],

  declarations: [
    AboutComponent,

    AboutInstanceComponent,
    ContactAdminModalComponent,
    InstanceStatisticsComponent,

    AboutPeertubeComponent,
    AboutFollowsComponent
  ],

  exports: [
    AboutComponent
  ],

  providers: [
    AboutInstanceResolver
  ]
})
export class AboutModule { }
