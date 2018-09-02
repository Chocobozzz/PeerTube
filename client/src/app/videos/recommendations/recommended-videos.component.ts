import { Component, Input, OnChanges } from '@angular/core'
import { Observable } from 'rxjs'
import { Video } from '@app/shared/video/video.model'
import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { User } from '@app/shared'

@Component({
  selector: 'my-recommended-videos',
  templateUrl: './recommended-videos.component.html'
})
export class RecommendedVideosComponent implements OnChanges {
  @Input() inputVideo: Video
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
    if (this.inputVideo) {
      this.store.requestNewRecommendations(this.inputVideo.uuid)
    }
  }

}
