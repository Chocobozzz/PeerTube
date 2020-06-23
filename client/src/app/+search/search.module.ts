import { TagInputModule } from 'ngx-chips'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedSearchModule } from '@app/shared/shared-search'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SearchService } from '../shared/shared-search/search.service'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'
import { SearchFiltersComponent } from './search-filters.component'
import { SearchRoutingModule } from './search-routing.module'
import { SearchComponent } from './search.component'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'

@NgModule({
  imports: [
    TagInputModule,

    SearchRoutingModule,

    SharedMainModule,
    SharedSearchModule,
    SharedFormModule,
    SharedUserSubscriptionModule,
    SharedVideoMiniatureModule
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
