import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VideoUpdateComponent } from './video-update.component'

const videoUpdateRoutes: Routes = [
  {
    path: '',
    component: VideoUpdateComponent,
    canActivateChild: [ MetaGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoUpdateRoutes) ],
  exports: [ RouterModule ]
})
export class VideoUpdateRoutingModule {}
