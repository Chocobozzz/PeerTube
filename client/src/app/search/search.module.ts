import { TagInputModule } from 'ngx-chips'
import { NgModule } from '@angular/core'
import { SearchFiltersComponent } from '@app/search/search-filters.component'
import { SearchRoutingModule } from '@app/search/search-routing.module'
import { SearchComponent } from '@app/search/search.component'
import { SearchService } from '@app/search/search.service'
import { SharedModule } from '../shared'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'

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
    SearchService,
    VideoLazyLoadResolver,
    ChannelLazyLoadResolver
  ]
})
export class SearchModule { }
