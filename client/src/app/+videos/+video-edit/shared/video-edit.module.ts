import { TagInputModule } from 'ngx-chips'
import { CalendarModule } from 'primeng/calendar'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'
import { VideoEditComponent } from './video-edit.component'

@NgModule({
  imports: [
    TagInputModule,
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideoEditComponent,
    VideoCaptionAddModalComponent
  ],

  exports: [
    TagInputModule,
    CalendarModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    VideoEditComponent
  ],

  providers: []
})
export class VideoEditModule { }
