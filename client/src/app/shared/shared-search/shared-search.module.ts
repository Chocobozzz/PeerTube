import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main'
import { SharedVideoPlaylistModule } from '../shared-video-playlist'
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
    SearchService
  ]
})
export class SharedSearchModule { }
