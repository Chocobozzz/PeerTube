import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../../core'
import { VideoAddComponent } from './video-add.component'

const videoAddRoutes: Routes = [
  {
    path: '',
    component: VideoAddComponent,
    canActivate: [ MetaGuard, LoginGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoAddRoutes) ],
  exports: [ RouterModule ]
})
export class VideoAddRoutingModule {}
