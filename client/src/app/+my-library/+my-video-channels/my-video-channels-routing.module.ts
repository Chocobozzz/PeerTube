import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
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
    redirectTo: '/manage/create'
  },
  {
    path: 'update/:videoChannelName',
    redirectTo: '/manage/update/:videoChannelName'
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myVideoChannelsRoutes) ],
  exports: [ RouterModule ]
})
export class MyVideoChannelsRoutingModule {}
