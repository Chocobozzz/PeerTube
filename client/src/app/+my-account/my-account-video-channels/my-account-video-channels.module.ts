import { NgModule } from '@angular/core'
import { ChartModule } from 'primeng/chart'
import { MyAccountVideoChannelsRoutingModule } from './my-account-video-channels-routing.module'
import { MyAccountVideoChannelsComponent } from './my-account-video-channels.component'
import { MyAccountVideoChannelCreateComponent } from './my-account-video-channel-create.component'
import { MyAccountVideoChannelUpdateComponent } from './my-account-video-channel-update.component'
import { SharedModule } from '@app/shared'

@NgModule({
  imports: [
    MyAccountVideoChannelsRoutingModule,
    SharedModule,
    ChartModule
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
