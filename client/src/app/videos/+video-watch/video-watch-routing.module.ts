import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VideoWatchComponent } from './video-watch.component'

const videoWatchRoutes: Routes = [
  {
    path: '',
    component: VideoWatchComponent,
    canActivate: [ MetaGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoWatchRoutes) ],
  exports: [ RouterModule ]
})
export class VideoWatchRoutingModule {}
