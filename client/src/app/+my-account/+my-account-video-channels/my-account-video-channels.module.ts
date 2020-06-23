import { ChartModule } from 'primeng/chart'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { MyAccountVideoChannelCreateComponent } from './my-account-video-channel-create.component'
import { MyAccountVideoChannelUpdateComponent } from './my-account-video-channel-update.component'
import { MyAccountVideoChannelsRoutingModule } from './my-account-video-channels-routing.module'
import { MyAccountVideoChannelsComponent } from './my-account-video-channels.component'

@NgModule({
  imports: [
    MyAccountVideoChannelsRoutingModule,

    ChartModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    MyAccountVideoChannelsComponent,
    MyAccountVideoChannelCreateComponent,
    MyAccountVideoChannelUpdateComponent
  ],

  exports: [],
  providers: []
})
export class MyAccountVideoChannelsModule { }
