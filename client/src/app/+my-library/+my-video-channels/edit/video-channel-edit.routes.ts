import { Routes } from '@angular/router'
import { VideoChannelEditGeneralComponent } from './pages/video-channel-edit-general.component'
import { VideoChannelEditEditorsComponent } from './pages/video-channel-editors.component'

export const videoChannelEditRoutes: Routes = [
  {
    path: '',
    redirectTo: 'general',
    pathMatch: 'full'
  },
  {
    path: 'general',
    component: VideoChannelEditGeneralComponent,
    data: {
      meta: {
        title: $localize`General channel configuration`
      }
    }
  },
  {
    path: 'editors',
    component: VideoChannelEditEditorsComponent,
    data: {
      meta: {
        title: $localize`Channel editors`
      }
    }
  }
]
