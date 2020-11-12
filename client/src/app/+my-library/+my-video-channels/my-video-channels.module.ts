import { ChartModule } from 'primeng/chart'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { MyVideoChannelCreateComponent } from './my-video-channel-create.component'
import { MyVideoChannelUpdateComponent } from './my-video-channel-update.component'
import { MyVideoChannelsRoutingModule } from './my-video-channels-routing.module'
import { MyVideoChannelsComponent } from './my-video-channels.component'

@NgModule({
  imports: [
    MyVideoChannelsRoutingModule,

    ChartModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    MyVideoChannelsComponent,
    MyVideoChannelCreateComponent,
    MyVideoChannelUpdateComponent
  ],

  exports: [],
  providers: []
})
export class MyVideoChannelsModule { }
