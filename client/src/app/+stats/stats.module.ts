import { ChartModule } from 'primeng/chart'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedVideoLiveModule } from '@app/shared/shared-video-live'
import { StatsRoutingModule } from './stats-routing.module'
import { VideoStatsComponent, VideoStatsService } from './video'

@NgModule({
  imports: [
    StatsRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedVideoLiveModule,

    ChartModule
  ],

  declarations: [
    VideoStatsComponent
  ],

  exports: [],
  providers: [
    VideoStatsService
  ]
})
export class StatsModule { }
