import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SearchRoutingModule } from '@app/search/search-routing.module'
import { SearchFiltersComponent } from '@app/search/search-filters.component'
import { CollapseModule } from 'ngx-bootstrap/collapse'

@NgModule({
  imports: [
    SearchRoutingModule,
    SharedModule,

    CollapseModule.forRoot()
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
