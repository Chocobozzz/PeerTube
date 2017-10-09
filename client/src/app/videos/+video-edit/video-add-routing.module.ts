import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VideoAddComponent } from './video-add.component'

const videoAddRoutes: Routes = [
  {
    path: '',
    component: VideoAddComponent,
    canActivateChild: [ MetaGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoAddRoutes) ],
  exports: [ RouterModule ]
})
export class VideoAddRoutingModule {}
