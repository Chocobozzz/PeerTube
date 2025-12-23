import { Routes } from '@angular/router'
import { VideoCaptionsComponent } from './captions/video-captions.component'
import { VideoChaptersComponent } from './chapters/video-chapters.component'
import { VideoCustomizationComponent } from './customization/video-customization.component'
import { VideoLiveSettingsComponent } from './live-settings/video-live-settings.component'
import { VideoMainInfoComponent } from './main-info/video-main-info.component'
import { VideoModerationComponent } from './moderation/video-moderation.component'
import { VideoReplaceFileComponent } from './replace-file/video-replace-file.component'
import { VideoStatsComponent } from './stats/video-stats.component'
import { VideoStudioEditComponent } from './studio/video-studio.component'

export const manageRoutes = [
  {
    path: '',
    component: VideoMainInfoComponent
  },
  {
    path: 'main-info',
    component: VideoMainInfoComponent
  },
  {
    path: 'captions',
    component: VideoCaptionsComponent
  },
  {
    path: 'chapters',
    component: VideoChaptersComponent
  },
  {
    path: 'customization',
    component: VideoCustomizationComponent
  },
  {
    path: 'live-settings',
    component: VideoLiveSettingsComponent
  },
  {
    path: 'moderation',
    component: VideoModerationComponent
  },
  {
    path: 'replace-file',
    component: VideoReplaceFileComponent
  },
  {
    path: 'stats',
    component: VideoStatsComponent
  },
  {
    path: 'studio',
    component: VideoStudioEditComponent
  }
] satisfies Routes
