import { NgModule } from '@angular/core'
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
    VideoEditComponent
  ],

  exports: [
    TagInputModule,
    TabsModule,

    VideoEditComponent
  ],

  providers: []
})
export class VideoEditModule { }
