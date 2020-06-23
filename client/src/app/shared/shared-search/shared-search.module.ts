import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main'
import { SearchService } from './search.service'

@NgModule({
  imports: [
    SharedMainModule
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
