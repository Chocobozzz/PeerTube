
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedSearchModule } from '@app/shared/shared-search'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist'
import { RecentVideosRecommendationService } from './recent-videos-recommendation.service'
import { RecommendedVideosComponent } from './recommended-videos.component'
import { RecommendedVideosStore } from './recommended-videos.store'

@NgModule({
  imports: [
    CommonModule,

    SharedMainModule,
    SharedSearchModule,
    SharedVideoPlaylistModule,
    SharedVideoMiniatureModule,
    SharedFormModule
  ],
  declarations: [
    RecommendedVideosComponent
  ],
  exports: [
    RecommendedVideosComponent
  ],
  providers: [
    RecommendedVideosStore,
    RecentVideosRecommendationService
  ]
})
export class RecommendationsModule {
}
