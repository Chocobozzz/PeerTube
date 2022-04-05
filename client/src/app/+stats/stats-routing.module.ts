import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoResolver } from '@app/shared/shared-main'
import { VideoStatsComponent } from './video'

const statsRoutes: Routes = [
  {
    path: 'videos/:videoId',
    component: VideoStatsComponent,
    data: {
      meta: {
        title: $localize`Video stats`
      }
    },
    resolve: {
      video: VideoResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(statsRoutes) ],
  exports: [ RouterModule ]
})
export class StatsRoutingModule {}
