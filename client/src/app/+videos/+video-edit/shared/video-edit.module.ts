import { CalendarModule } from 'primeng/calendar'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedVideoLiveModule } from '@app/shared/shared-video-live'
import { I18nPrimengCalendarService } from './i18n-primeng-calendar.service'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoCaptionEditModalContentComponent } from './video-caption-edit-modal-content/video-caption-edit-modal-content.component'
import { VideoEditComponent } from './video-edit.component'
import { VideoReplaceComponent } from './video-replace.component'
import { UploadxModule } from 'ngx-uploadx'
import { DragDropDirective } from './drag-drop.directive'

@NgModule({
  imports: [
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedVideoLiveModule,

    UploadxModule
  ],

  declarations: [
    VideoEditComponent,
    VideoCaptionAddModalComponent,
    VideoCaptionEditModalContentComponent,
    VideoReplaceComponent,
    DragDropDirective
  ],

  exports: [
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    VideoEditComponent
  ],

  providers: [
    I18nPrimengCalendarService
  ]
})
export class VideoEditModule { }
