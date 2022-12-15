
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { SharedThumbnailModule } from '../shared-thumbnail'
import { SharedVideoModule } from '../shared-video'
import { VideoAddToPlaylistComponent } from './video-add-to-playlist.component'
import { VideoPlaylistElementMiniatureComponent } from './video-playlist-element-miniature.component'
import { VideoPlaylistMiniatureComponent } from './video-playlist-miniature.component'
import { VideoPlaylistService } from './video-playlist.service'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedThumbnailModule,
    SharedGlobalIconModule,
    SharedVideoModule
  ],

  declarations: [
    VideoAddToPlaylistComponent,
    VideoPlaylistElementMiniatureComponent,
    VideoPlaylistMiniatureComponent
  ],

  exports: [
    VideoAddToPlaylistComponent,
    VideoPlaylistElementMiniatureComponent,
    VideoPlaylistMiniatureComponent
  ],

  providers: [
    VideoPlaylistService
  ]
})
export class SharedVideoPlaylistModule { }
