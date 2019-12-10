import { NgModule } from '@angular/core'
import { InputSwitchModule } from 'primeng/inputswitch'
import { RecommendedVideosComponent } from '@app/videos/recommendations/recommended-videos.component'
import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { CommonModule } from '@angular/common'
import { SharedModule } from '@app/shared'
import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'

@NgModule({
  imports: [
    InputSwitchModule,
    SharedModule,
    CommonModule
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
