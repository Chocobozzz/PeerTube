import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MyAccountVideoChannelUpdateComponent } from './my-account-video-channel-update.component'
import { MyAccountVideoChannelCreateComponent } from './my-account-video-channel-create.component'
import { MyAccountVideoChannelsComponent } from './my-account-video-channels.component'

const myAccountVideoChannelsRoutes: Routes = [
  {
    path: '',
    component: MyAccountVideoChannelsComponent,
    data: {
      meta: {
        title: 'Account video channels'
      }
    }
  },
  {
    path: 'create',
    component: MyAccountVideoChannelCreateComponent,
    data: {
      meta: {
        title: 'Create new video channel'
      }
    }
  },
  {
    path: 'update/:videoChannelId',
    component: MyAccountVideoChannelUpdateComponent,
    data: {
      meta: {
        title: 'Update video channel'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myAccountVideoChannelsRoutes) ],
  exports: [ RouterModule ]
})
export class MyAccountVideoChannelsRoutingModule {}
