import { NgModule } from '@angular/core'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { TagInputModule } from 'ngx-chips'
import { SharedModule } from '../../../shared/'
import { VideoEditComponent } from './video-edit.component'
import { VideoImageComponent } from './video-image.component'

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
