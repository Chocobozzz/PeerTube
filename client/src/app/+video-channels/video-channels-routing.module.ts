import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VideoChannelAboutComponent } from './video-channel-about/video-channel-about.component'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsComponent } from './video-channels.component'

const videoChannelsRoutes: Routes = [
  {
    path: ':videoChannelName',
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
          },
          reuse: {
            enabled: true,
            key: 'video-channel-videos-list'
          }
        }
      },
      {
        path: 'video-playlists',
        component: VideoChannelPlaylistsComponent,
        data: {
          meta: {
            title: 'Video channel playlists'
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
