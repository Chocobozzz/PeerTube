import { NgModule } from '@angular/core'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { TagInputModule } from 'ngx-chips'
import { SharedModule } from '../../../shared/'
import { VideoEditComponent } from './video-edit.component'
import { VideoImageComponent } from './video-image.component'
import { CalendarModule } from 'primeng/components/calendar/calendar'

@NgModule({
  imports: [
    TagInputModule,
    CalendarModule,

    SharedModule
  ],

  declarations: [
    VideoEditComponent,
    VideoImageComponent
  ],

  exports: [
    TagInputModule,
    TabsModule,
    CalendarModule,

    VideoEditComponent
  ],

  providers: []
})
export class VideoEditModule { }
