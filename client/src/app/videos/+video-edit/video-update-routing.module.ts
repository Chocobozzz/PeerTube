import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../../core'
import { VideoUpdateComponent } from './video-update.component'

const videoUpdateRoutes: Routes = [
  {
    path: '',
    component: VideoUpdateComponent,
    canActivate: [ MetaGuard, LoginGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoUpdateRoutes) ],
  exports: [ RouterModule ]
})
export class VideoUpdateRoutingModule {}
