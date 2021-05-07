
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '../shared-actor-image/shared-actor-image.module'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main'
import { SharedVideoMiniatureModule } from '../shared-video-miniature'
import { SharedVideoPlaylistModule } from '../shared-video-playlist'
import { ChannelMiniatureMarkupComponent } from './channel-miniature-markup.component'
import { CustomMarkupService } from './custom-markup.service'
import { DynamicElementService } from './dynamic-element.service'
import { EmbedMarkupComponent } from './embed-markup.component'
import { PlaylistMiniatureMarkupComponent } from './playlist-miniature-markup.component'
import { VideoMiniatureMarkupComponent } from './video-miniature-markup.component'
import { VideosListMarkupComponent } from './videos-list-markup.component'

@NgModule({
  imports: [
    CommonModule,

    SharedMainModule,
    SharedGlobalIconModule,
    SharedVideoMiniatureModule,
    SharedVideoPlaylistModule,
    SharedActorImageModule
  ],

  declarations: [
    VideoMiniatureMarkupComponent,
    PlaylistMiniatureMarkupComponent,
    ChannelMiniatureMarkupComponent,
    EmbedMarkupComponent,
    VideosListMarkupComponent
  ],

  exports: [
    VideoMiniatureMarkupComponent,
    PlaylistMiniatureMarkupComponent,
    ChannelMiniatureMarkupComponent,
    VideosListMarkupComponent,
    EmbedMarkupComponent
  ],

  providers: [
    CustomMarkupService,
    DynamicElementService
  ]
})
export class SharedCustomMarkupModule { }
