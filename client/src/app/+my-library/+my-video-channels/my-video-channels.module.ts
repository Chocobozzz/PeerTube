import { ChartModule } from 'primeng/chart'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { MyVideoChannelsRoutingModule } from './my-video-channels-routing.module'
import { MyVideoChannelsComponent } from './my-video-channels.component'
import { SharedActorImageModule } from '@app/shared/shared-actor-image/shared-actor-image.module'

@NgModule({
  imports: [
    MyVideoChannelsRoutingModule,

    ChartModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedActorImageModule
  ],

  declarations: [
    MyVideoChannelsComponent
  ],

  exports: [],
  providers: []
})
export class MyVideoChannelsModule { }
