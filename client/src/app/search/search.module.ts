import { NgModule } from '@angular/core'
import { TagInputModule } from 'ngx-chips'
import { SharedModule } from '../shared'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SearchRoutingModule } from '@app/search/search-routing.module'
import { SearchFiltersComponent } from '@app/search/search-filters.component'

@NgModule({
  imports: [
    TagInputModule,

    SearchRoutingModule,
    SharedModule
  ],

  declarations: [
    SearchComponent,
    SearchFiltersComponent
  ],

  exports: [
    TagInputModule,
    SearchComponent
  ],

  providers: [
    SearchService
  ]
})
export class SearchModule { }
