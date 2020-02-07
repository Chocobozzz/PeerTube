import { NgModule } from '@angular/core'
import { TagInputModule } from 'ngx-chips'
import { SharedModule } from '../../../shared/'
import { VideoEditComponent } from './video-edit.component'
import { CalendarModule } from 'primeng/calendar'
import { VideoCaptionAddModalComponent } from './video-caption-add-modal.component'

@NgModule({
  imports: [
    TagInputModule,
    CalendarModule,

    SharedModule
  ],

  declarations: [
    VideoEditComponent,
    VideoCaptionAddModalComponent
  ],

  exports: [
    TagInputModule,
    CalendarModule,

    VideoEditComponent
  ],

  providers: []
})
export class VideoEditModule { }
