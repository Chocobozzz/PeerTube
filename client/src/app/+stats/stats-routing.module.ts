import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { VideoResolver } from '@app/shared/shared-main'
import { VideoStatsComponent } from './video'

const statsRoutes: Routes = [
  {
    path: 'videos/:videoId',
    canActivate: [ LoginGuard ],
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
