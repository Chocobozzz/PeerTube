import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MyVideoChannelCreateComponent } from './video-channel-edit/video-channel-create.component'
import { VideoChannelUpdateComponent } from './video-channel-edit/video-channel-update.component'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsComponent } from './video-channels.component'

const videoChannelsRoutes: Routes = [
  {
    path: '@create',
    component: MyVideoChannelCreateComponent,
    data: {
      meta: {
        title: $localize`Create a new video channel`
      }
    }
  },
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
  },
  {
    path: ':videoChannelName/update',
    component: VideoChannelUpdateComponent,

    data: {
      meta: {
        title: $localize`Update video channel`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoChannelsRoutes) ],
  exports: [ RouterModule ]
})
export class VideoChannelsRoutingModule {}
