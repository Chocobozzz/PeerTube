import { TagInputModule } from 'ngx-chips'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'
import { HighlightPipe } from './highlight.pipe'
import { SearchFiltersComponent } from './search-filters.component'
import { SearchRoutingModule } from './search-routing.module'
import { SearchComponent } from './search.component'
import { SearchService } from './search.service'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'

@NgModule({
  imports: [
    TagInputModule,

    SearchRoutingModule,
    SharedMainModule,
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
    ChannelLazyLoadResolver,
    HighlightPipe
  ]
})
export class SearchModule { }
