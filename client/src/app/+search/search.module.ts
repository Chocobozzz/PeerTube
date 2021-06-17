import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '@app/shared/shared-actor-image/shared-actor-image.module'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedSearchModule } from '@app/shared/shared-search'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { SearchService } from '../shared/shared-search/search.service'
import { SearchFiltersComponent } from './search-filters.component'
import { SearchRoutingModule } from './search-routing.module'
import { SearchComponent } from './search.component'
import { ChannelLazyLoadResolver, PlaylistLazyLoadResolver, VideoLazyLoadResolver } from './shared'

@NgModule({
  imports: [
    SearchRoutingModule,

    SharedMainModule,
    SharedSearchModule,
    SharedFormModule,
    SharedActorImageModule,
    SharedUserSubscriptionModule,
    SharedVideoMiniatureModule,
    SharedVideoPlaylistModule
  ],

  declarations: [
    SearchComponent,
    SearchFiltersComponent
  ],

  exports: [
    SearchComponent
  ],

  providers: [
    SearchService,
    VideoLazyLoadResolver,
    ChannelLazyLoadResolver,
    PlaylistLazyLoadResolver
  ]
})
export class SearchModule { }
