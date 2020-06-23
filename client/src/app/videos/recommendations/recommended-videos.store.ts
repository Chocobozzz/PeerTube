import { Observable, ReplaySubject } from 'rxjs'
import { map, shareReplay, switchMap, take } from 'rxjs/operators'
import { Inject, Injectable } from '@angular/core'
import { Video } from '@app/shared/shared-main'
import { RecentVideosRecommendationService } from './recent-videos-recommendation.service'
import { RecommendationInfo } from './recommendation-info.model'
import { RecommendationService } from './recommendations.service'

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
        return this.recommendations.getRecommendations(requestedRecommendation)
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
