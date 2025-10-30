import { Routes } from '@angular/router'
import { VideoChannelActivitiesComponent } from './pages/video-channel-activities.component'
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
  },
  {
    path: 'activities',
    component: VideoChannelActivitiesComponent,
    data: {
      meta: {
        title: $localize`Channel activities`
      }
    }
  }
]
