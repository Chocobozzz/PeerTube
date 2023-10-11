import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '../shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from '../shared-forms'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { SharedModerationModule } from '../shared-moderation'
import { SharedThumbnailModule } from '../shared-thumbnail'
import { SharedVideoModule } from '../shared-video'
import { SharedVideoLiveModule } from '../shared-video-live'
import { SharedVideoPlaylistModule } from '../shared-video-playlist/shared-video-playlist.module'
import { VideoActionsDropdownComponent } from './video-actions-dropdown.component'
import { VideoDownloadComponent } from './video-download.component'
import { VideoFiltersHeaderComponent } from './video-filters-header.component'
import { VideoMiniatureComponent } from './video-miniature.component'
import { VideosListComponent } from './videos-list.component'
import { VideosSelectionComponent } from './videos-selection.component'

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
    VideoFiltersHeaderComponent,
    VideosListComponent
  ],

  exports: [
    VideoActionsDropdownComponent,
    VideoDownloadComponent,
    VideoMiniatureComponent,
    VideosSelectionComponent,
    VideoFiltersHeaderComponent,
    VideosListComponent
  ],

  providers: [ ]
})
export class SharedVideoMiniatureModule { }
