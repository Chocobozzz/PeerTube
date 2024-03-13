import { Routes } from '@angular/router'
import { MyVideoChannelsComponent } from './my-video-channels.component'

export default [
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
] satisfies Routes
