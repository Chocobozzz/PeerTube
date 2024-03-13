import { Routes } from '@angular/router'
import { VideoChannelCreateComponent } from './video-channel-edit/video-channel-create.component'
import { VideoChannelUpdateComponent } from './video-channel-edit/video-channel-update.component'

export default [
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
