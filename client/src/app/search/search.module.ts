import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SearchRoutingModule } from '@app/search/search-routing.module'

@NgModule({
  imports: [
    SearchRoutingModule,
    SharedModule
  ],

  declarations: [
    SearchComponent
  ],

  exports: [
    SearchComponent
  ],

  providers: [
    SearchService
  ]
})
export class SearchModule { }
