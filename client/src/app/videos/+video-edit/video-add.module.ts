import { NgModule } from '@angular/core'
import { ProgressBarModule } from 'primeng/primeng'
import { SharedModule } from '../../shared'
import { VideoEditModule } from './shared/video-edit.module'
import { VideoAddRoutingModule } from './video-add-routing.module'
import { VideoAddComponent } from './video-add.component'
import { CanDeactivateGuard } from '../../shared/guards/can-deactivate-guard.service'
import { VideoUploadComponent } from '@app/videos/+video-edit/video-upload.component'
import { VideoImportComponent } from '@app/videos/+video-edit/video-import.component'

@NgModule({
  imports: [
    VideoAddRoutingModule,
    VideoEditModule,
    SharedModule,
    ProgressBarModule
  ],
  declarations: [
    VideoAddComponent,
    VideoUploadComponent,
    VideoImportComponent
  ],
  exports: [
    VideoAddComponent
  ],
  providers: [
    CanDeactivateGuard
  ]
})
export class VideoAddModule { }
