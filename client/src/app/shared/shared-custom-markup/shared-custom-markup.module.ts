
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main'
import { SharedVideoMiniatureModule } from '../shared-video-miniature'
import { SharedVideoPlaylistModule } from '../shared-video-playlist'
import { CustomMarkupService } from './custom-markup.service'
import { DynamicElementService } from './dynamic-element.service'
import { EmbedMarkupComponent } from './embed-markup.component'
import { PlaylistMiniatureMarkupComponent } from './playlist-miniature-markup.component'
import { VideoMiniatureMarkupComponent } from './video-miniature-markup.component'

@NgModule({
  imports: [
    CommonModule,

    SharedMainModule,
    SharedGlobalIconModule,
    SharedVideoMiniatureModule,
    SharedVideoPlaylistModule
  ],

  declarations: [
    VideoMiniatureMarkupComponent,
    PlaylistMiniatureMarkupComponent,
    EmbedMarkupComponent
  ],

  exports: [
    VideoMiniatureMarkupComponent,
    PlaylistMiniatureMarkupComponent,
    EmbedMarkupComponent
  ],

  providers: [
    CustomMarkupService,
    DynamicElementService
  ]
})
export class SharedCustomMarkupModule { }
