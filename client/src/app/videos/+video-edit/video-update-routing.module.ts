import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { MetaGuard } from '@ngx-meta/core'
import { VideoUpdateComponent } from './video-update.component'
import { VideoUpdateResolver } from './video-update.resolver'

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
