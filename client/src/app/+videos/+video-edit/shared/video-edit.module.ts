import { CalendarModule } from 'primeng/calendar'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedVideoLiveModule } from '@app/shared/shared-video-live'
import { I18nPrimengCalendarService } from './i18n-primeng-calendar.service'
import { UploadProgressComponent } from './upload-progress.component'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoCaptionEditModalContentComponent } from './video-caption-edit-modal-content/video-caption-edit-modal-content.component'
import { VideoEditComponent } from './video-edit.component'
import { VideoUploadService } from './video-upload.service'

@NgModule({
  imports: [
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedVideoLiveModule
  ],

  declarations: [
    VideoEditComponent,
    VideoCaptionAddModalComponent,
    VideoCaptionEditModalContentComponent,
    UploadProgressComponent
  ],

  exports: [
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    VideoEditComponent,
    UploadProgressComponent
  ],

  providers: [
    I18nPrimengCalendarService,
    VideoUploadService
  ]
})
export class VideoEditModule { }
