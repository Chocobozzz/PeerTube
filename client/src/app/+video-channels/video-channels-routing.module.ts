import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VideoChannelsComponent } from './video-channels.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelAboutComponent } from './video-channel-about/video-channel-about.component'

const videoChannelsRoutes: Routes = [
  {
    path: ':videoChannelId',
    component: VideoChannelsComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: '',
        redirectTo: 'videos',
        pathMatch: 'full'
      },
      {
        path: 'videos',
        component: VideoChannelVideosComponent,
        data: {
          meta: {
            title: 'Video channel videos'
          }
        }
      },
      {
        path: 'about',
        component: VideoChannelAboutComponent,
        data: {
          meta: {
            title: 'About video channel'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoChannelsRoutes) ],
  exports: [ RouterModule ]
})
export class VideoChannelsRoutingModule {}
