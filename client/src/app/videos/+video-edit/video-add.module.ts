import { NgModule } from '@angular/core'
import { SharedModule } from '../../shared'
import { VideoEditModule } from './shared/video-edit.module'
import { VideoAddRoutingModule } from './video-add-routing.module'
import { VideoAddComponent } from './video-add.component'
import { DragDropDirective } from './video-add-components/drag-drop.directive'
import { CanDeactivateGuard } from '../../shared/guards/can-deactivate-guard.service'
import { VideoUploadComponent } from '@app/videos/+video-edit/video-add-components/video-upload.component'
import { VideoImportUrlComponent } from '@app/videos/+video-edit/video-add-components/video-import-url.component'
import { VideoImportTorrentComponent } from '@app/videos/+video-edit/video-add-components/video-import-torrent.component'

@NgModule({
  imports: [
    VideoAddRoutingModule,
    VideoEditModule,
    SharedModule
  ],
  declarations: [
    VideoAddComponent,
    VideoUploadComponent,
    VideoImportUrlComponent,
    VideoImportTorrentComponent,
    DragDropDirective
  ],
  exports: [
    VideoAddComponent,
    DragDropDirective
  ],
  providers: [
    CanDeactivateGuard
  ]
})
export class VideoAddModule { }
