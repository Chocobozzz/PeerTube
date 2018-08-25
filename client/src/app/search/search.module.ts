import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SearchRoutingModule } from '@app/search/search-routing.module'
import { SearchFiltersComponent } from '@app/search/search-filters.component'
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap'

@NgModule({
  imports: [
    SearchRoutingModule,
    SharedModule,

    NgbCollapseModule.forRoot()
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
