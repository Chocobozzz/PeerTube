import { NgModule } from '@angular/core'

import { TagInputModule } from 'ngx-chips'
import { TabsModule } from 'ngx-bootstrap/tabs'

import { MarkdownService } from '../../shared'
import { SharedModule } from '../../../shared'
import { VideoDescriptionComponent } from './video-description.component'
import { VideoEditComponent } from './video-edit.component'

@NgModule({
  imports: [
    TagInputModule,
    TabsModule.forRoot(),

    SharedModule
  ],

  declarations: [
    VideoDescriptionComponent,
    VideoEditComponent
  ],

  exports: [
    TagInputModule,
    TabsModule,

    VideoDescriptionComponent,
    VideoEditComponent
  ],

  providers: [
    MarkdownService
  ]
})
export class VideoEditModule { }
