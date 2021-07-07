
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { SharedModerationModule } from '../shared-moderation'
import { SharedVideoModule } from '../shared-video'
import { SharedThumbnailModule } from '../shared-thumbnail'
import { SharedVideoLiveModule } from '../shared-video-live'
import { SharedVideoPlaylistModule } from '../shared-video-playlist/shared-video-playlist.module'
import { VideoActionsDropdownComponent } from './video-actions-dropdown.component'
import { VideoDownloadComponent } from './video-download.component'
import { VideoMiniatureComponent } from './video-miniature.component'
import { VideosSelectionComponent } from './videos-selection.component'
import { VideoListHeaderComponent } from './video-list-header.component'
import { SharedActorImageModule } from '../shared-actor-image/shared-actor-image.module'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedModerationModule,
    SharedVideoPlaylistModule,
    SharedThumbnailModule,
    SharedGlobalIconModule,
    SharedVideoLiveModule,
    SharedVideoModule,
    SharedActorImageModule
  ],

  declarations: [
    VideoActionsDropdownComponent,
    VideoDownloadComponent,
    VideoMiniatureComponent,
    VideosSelectionComponent,
    VideoListHeaderComponent
  ],

  exports: [
    VideoActionsDropdownComponent,
    VideoDownloadComponent,
    VideoMiniatureComponent,
    VideosSelectionComponent
  ],

  providers: [ ]
})
export class SharedVideoMiniatureModule { }
