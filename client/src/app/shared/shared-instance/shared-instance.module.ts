import { NgModule } from '@angular/core'
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { FeatureBooleanComponent } from './feature-boolean.component'
import { InstanceAboutAccordionComponent } from './instance-about-accordion.component'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'
import { InstanceFollowService } from './instance-follow.service'
import { InstanceService } from './instance.service'
import { InstanceBannerComponent } from './instance-banner.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedGlobalIconModule,
    NgbAccordionModule
  ],

  declarations: [
    FeatureBooleanComponent,
    InstanceAboutAccordionComponent,
    InstanceFeaturesTableComponent,
    InstanceBannerComponent
  ],

  exports: [
    FeatureBooleanComponent,
    InstanceAboutAccordionComponent,
    InstanceFeaturesTableComponent,
    InstanceBannerComponent
  ],

  providers: [
    InstanceFollowService,
    InstanceService
  ]
})
export class SharedInstanceModule { }
