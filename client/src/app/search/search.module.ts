import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SearchRoutingModule } from '@app/search/search-routing.module'
import { SearchFiltersComponent } from '@app/search/search-filters.component'

@NgModule({
  imports: [
    SearchRoutingModule,
    SharedModule
  ],

  declarations: [
    SearchComponent,
    SearchFiltersComponent
  ],

  exports: [
    SearchComponent
  ],

  providers: [
    SearchService
  ]
})
export class SearchModule { }
