import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../../core'
import { CanDeactivateGuard } from '../../shared/guards/can-deactivate-guard.service'
import { VideoAddComponent } from './video-add.component'

const videoAddRoutes: Routes = [
  {
    path: '',
    component: VideoAddComponent,
    canActivate: [ MetaGuard, LoginGuard ],
    canDeactivate: [ CanDeactivateGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoAddRoutes) ],
  exports: [ RouterModule ]
})
export class VideoAddRoutingModule {}
