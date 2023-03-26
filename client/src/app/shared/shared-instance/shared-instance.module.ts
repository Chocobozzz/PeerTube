import { NgModule } from '@angular/core'
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { FeatureBooleanComponent } from './feature-boolean.component'
import { InstanceAboutAccordionComponent } from './instance-about-accordion.component'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'
import { InstanceFollowService } from './instance-follow.service'
import { InstanceService } from './instance.service'

@NgModule({
  imports: [
    SharedMainModule,
    SharedGlobalIconModule,
    NgbAccordionModule
  ],

  declarations: [
    FeatureBooleanComponent,
    InstanceAboutAccordionComponent,
    InstanceFeaturesTableComponent
  ],

  exports: [
    FeatureBooleanComponent,
    InstanceAboutAccordionComponent,
    InstanceFeaturesTableComponent
  ],

  providers: [
    InstanceFollowService,
    InstanceService
  ]
})
export class SharedInstanceModule { }
