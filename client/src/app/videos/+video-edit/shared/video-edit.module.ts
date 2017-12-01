import { NgModule } from '@angular/core'

import { TagInputModule } from 'ngx-chips'
import { TabsModule } from 'ngx-bootstrap/tabs'

import { MarkdownService, VideoDescriptionComponent } from '../../shared'
import { SharedModule } from '../../../shared'

@NgModule({
  imports: [
    TagInputModule,
    TabsModule.forRoot(),

    SharedModule
  ],

  declarations: [
    VideoDescriptionComponent
  ],

  exports: [
    TagInputModule,
    TabsModule,

    VideoDescriptionComponent
  ],

  providers: [
    MarkdownService
  ]
})
export class VideoEditModule { }
