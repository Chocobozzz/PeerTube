import { Component, Input, OnChanges } from '@angular/core'
import { Observable } from 'rxjs'
import { Video } from '@app/shared/video/video.model'
import { RecommendationInfo } from '@app/shared/video/recommendation-info.model'
import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { User } from '@app/shared'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html'
})
export class RecommendedVideosComponent implements OnChanges {
  @Input() inputRecommendation: RecommendationInfo
  @Input() user: User

  readonly hasVideos$: Observable<boolean>
  readonly videos$: Observable<Video[]>

  constructor (
    private store: RecommendedVideosStore
  ) {
    this.videos$ = this.store.recommendations$
    this.hasVideos$ = this.store.hasRecommendations$
  }

  public ngOnChanges (): void {
    if (this.inputRecommendation) {
      this.store.requestNewRecommendations(this.inputRecommendation)
    }
  }

  onVideoRemoved () {
    this.store.requestNewRecommendations(this.inputRecommendation)
  }
}
