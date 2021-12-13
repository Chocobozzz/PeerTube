import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoChannelCreateComponent } from './video-channel-edit/video-channel-create.component'
import { VideoChannelUpdateComponent } from './video-channel-edit/video-channel-update.component'

const manageRoutes: Routes = [
  {
    path: 'create',
    component: VideoChannelCreateComponent,
    data: {
      meta: {
        title: $localize`Create a new video channel`
      }
    }
  },
  {
    path: 'update/:videoChannelName',
    component: VideoChannelUpdateComponent,
    data: {
      meta: {
        title: $localize`Update video channel`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(manageRoutes) ],
  exports: [ RouterModule ]
})
export class ManageRoutingModule {}
