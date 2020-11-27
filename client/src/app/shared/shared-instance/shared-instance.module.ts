
import { NgModule } from '@angular/core'
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { FeatureBooleanComponent } from './feature-boolean.component'
import { InstanceAboutAccordion } from './instance-about-accordion.component'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'
import { InstanceFollowService } from './instance-follow.service'
import { InstanceStatisticsComponent } from './instance-statistics.component'
import { InstanceService } from './instance.service'

@NgModule({
  imports: [
    SharedMainModule,
    NgbAccordionModule
  ],

  declarations: [
    FeatureBooleanComponent,
    InstanceAboutAccordion,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent
  ],

  exports: [
    FeatureBooleanComponent,
    InstanceAboutAccordion,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent
  ],

  providers: [
    InstanceFollowService,
    InstanceService
  ]
})
export class SharedInstanceModule { }
