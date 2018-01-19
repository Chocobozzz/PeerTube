import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../../core'
import { VideoUploadGuard } from "./video-upload-guard";
import { VideoAddComponent } from './video-add.component'

const videoAddRoutes: Routes = [
  {
    path: '',
    component: VideoAddComponent,
    canActivate: [ MetaGuard, LoginGuard ],
    canDeactivate: [VideoUploadGuard]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoAddRoutes) ],
  exports: [ RouterModule ]
})
export class VideoAddRoutingModule {}
