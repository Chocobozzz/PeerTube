import { Routes } from '@angular/router'
import { VideoChannelCreateComponent } from '@app/shared/standalone-channels/video-channel-create.component'
import { VideoChannelUpdateComponent } from '@app/shared/standalone-channels/video-channel-update.component'

// Keep these routes to have a non "/my-library" URL to manage video channels
// This can be useful for admins/moderators for example

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
