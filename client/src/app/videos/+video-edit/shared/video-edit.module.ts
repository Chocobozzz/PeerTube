import { NgModule } from '@angular/core'
import { VideoImageComponent } from '@app/videos/+video-edit/shared/video-image.component'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { TagInputModule } from 'ngx-chips'
import { SharedModule } from '../../../shared'
import { VideoEditComponent } from './video-edit.component'

@NgModule({
  imports: [
    TagInputModule,

    SharedModule
  ],

  declarations: [
    VideoEditComponent,
    VideoImageComponent
  ],

  exports: [
    TagInputModule,
    TabsModule,

    VideoEditComponent
  ],

  providers: []
})
export class VideoEditModule { }
