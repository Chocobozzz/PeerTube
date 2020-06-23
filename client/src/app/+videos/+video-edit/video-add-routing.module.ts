import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { MetaGuard } from '@ngx-meta/core'
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
