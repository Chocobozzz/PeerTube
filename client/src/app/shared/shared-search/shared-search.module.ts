import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main'
import { SharedVideoPlaylistModule } from '../shared-video-playlist'
import { FindInBulkService } from './find-in-bulk.service'
import { SearchService } from './search.service'

@NgModule({
  imports: [
    SharedMainModule,
    SharedVideoPlaylistModule
  ],

  declarations: [
  ],

  exports: [
  ],

  providers: [
    FindInBulkService,
    SearchService
  ]
})
export class SharedSearchModule { }
