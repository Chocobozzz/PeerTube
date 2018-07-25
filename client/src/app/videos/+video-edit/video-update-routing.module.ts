import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../../core'
import { VideoUpdateComponent } from './video-update.component'
import { VideoUpdateResolver } from '@app/videos/+video-edit/video-update.resolver'
import { CanDeactivateGuard } from '@app/shared/guards/can-deactivate-guard.service'

const videoUpdateRoutes: Routes = [
  {
    path: '',
    component: VideoUpdateComponent,
    canActivate: [ MetaGuard, LoginGuard ],
    canDeactivate: [ CanDeactivateGuard ],
    resolve: {
      videoData: VideoUpdateResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoUpdateRoutes) ],
  exports: [ RouterModule ]
})
export class VideoUpdateRoutingModule {}
