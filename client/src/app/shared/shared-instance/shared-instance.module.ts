
import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { FeatureBooleanComponent } from './feature-boolean.component'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'
import { InstanceFollowService } from './instance-follow.service'
import { InstanceStatisticsComponent } from './instance-statistics.component'
import { InstanceService } from './instance.service'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [
    FeatureBooleanComponent,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent
  ],

  exports: [
    FeatureBooleanComponent,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent
  ],

  providers: [
    InstanceFollowService,
    InstanceService
  ]
})
export class SharedInstanceModule { }
