import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsComponent } from './video-channels.component'

const videoChannelsRoutes: Routes = [
  {
    path: ':videoChannelName',
    component: VideoChannelsComponent,
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
            title: $localize`Video channel videos`
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
            title: $localize`Video channel playlists`
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
