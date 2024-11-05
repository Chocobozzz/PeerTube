import { Routes } from '@angular/router'
import { VideoChannelCreateComponent } from '@app/shared/standalone-channels/video-channel-create.component'
import { VideoChannelUpdateComponent } from '@app/shared/standalone-channels/video-channel-update.component'
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
] satisfies Routes
