import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { VideoChannelsRoutingModule } from './video-channels-routing.module'
import { VideoChannelsComponent } from './video-channels.component'
import { VideoChannelVideosComponent } from './video-channel-videos/video-channel-videos.component'
import { VideoChannelAboutComponent } from './video-channel-about/video-channel-about.component'

@NgModule({
  imports: [
    VideoChannelsRoutingModule,
    SharedModule
  ],

  declarations: [
    VideoChannelsComponent,
    VideoChannelVideosComponent,
    VideoChannelAboutComponent
  ],

  exports: [
    VideoChannelsComponent
  ],

  providers: []
})
export class VideoChannelsModule { }
