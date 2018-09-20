import { Inject, Injectable } from '@angular/core'
import { Observable, ReplaySubject } from 'rxjs'
import { Video } from '@app/shared/video/video.model'
import { RecommendationInfo } from '@app/shared/video/recommendation-info.model'
import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { map, shareReplay, switchMap, take } from 'rxjs/operators'

/**
 * This store is intended to provide data for the RecommendedVideosComponent.
 */
@Injectable()
export class RecommendedVideosStore {
  public readonly recommendations$: Observable<Video[]>
  public readonly hasRecommendations$: Observable<boolean>
  private readonly requestsForLoad$$ = new ReplaySubject<RecommendationInfo>(1)

  constructor (
    @Inject(RecentVideosRecommendationService) private recommendations: RecommendationService
  ) {
    this.recommendations$ = this.requestsForLoad$$.pipe(
      switchMap(requestedRecommendation => {
        return recommendations.getRecommendations(requestedRecommendation)
                              .pipe(take(1))
      }),
      shareReplay()
    )

    this.hasRecommendations$ = this.recommendations$.pipe(
      map(otherVideos => otherVideos.length > 0)
    )
  }

  requestNewRecommendations (recommend: RecommendationInfo) {
    this.requestsForLoad$$.next(recommend)
  }
}
