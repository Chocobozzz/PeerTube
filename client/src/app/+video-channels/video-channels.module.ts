import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { VideoChannelAboutComponent } from './video-channel-about/video-channel-about.component'
import { VideoChannelPlaylistsComponent } from './video-channel-playlists/video-channel-playlists.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelsRoutingModule } from './video-channels-routing.module'
import { VideoChannelsComponent } from './video-channels.component'

@NgModule({
  imports: [
    VideoChannelsRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedVideoPlaylistModule,
    SharedVideoMiniatureModule,
    SharedUserSubscriptionModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideoChannelsComponent,
    VideoChannelVideosComponent,
    VideoChannelAboutComponent,
    VideoChannelPlaylistsComponent
  ],

  exports: [
    VideoChannelsComponent
  ],

  providers: []
})
export class VideoChannelsModule { }
