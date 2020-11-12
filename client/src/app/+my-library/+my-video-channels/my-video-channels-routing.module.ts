import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MyVideoChannelUpdateComponent } from './my-video-channel-update.component'
import { MyVideoChannelCreateComponent } from './my-video-channel-create.component'
import { MyVideoChannelsComponent } from './my-video-channels.component'

const myVideoChannelsRoutes: Routes = [
  {
    path: '',
    component: MyVideoChannelsComponent,
    data: {
      meta: {
        title: $localize`My video channels`
      }
    }
  },
  {
    path: 'create',
    component: MyVideoChannelCreateComponent,
    data: {
      meta: {
        title: $localize`Create a new video channel`
      }
    }
  },
  {
    path: 'update/:videoChannelId',
    component: MyVideoChannelUpdateComponent,
    data: {
      meta: {
        title: $localize`Update video channel`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myVideoChannelsRoutes) ],
  exports: [ RouterModule ]
})
export class MyVideoChannelsRoutingModule {}
