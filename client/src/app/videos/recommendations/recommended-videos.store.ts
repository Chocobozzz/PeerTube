import { Inject, Injectable } from '@angular/core'
import { Observable, ReplaySubject } from 'rxjs'
import { Video } from '@app/shared/video/video.model'
import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { map, switchMap } from 'rxjs/operators'
import { fromPromise } from 'rxjs/internal-compatibility'

type UUID = string

/**
 * This store is intended to provide data for the RecommendedVideosComponent.
 */
@Injectable()
export class RecommendedVideosStore {
  public readonly recommendations$: Observable<Video[]>
  public readonly hasRecommendations$: Observable<boolean>
  private readonly requestsForLoad$$ = new ReplaySubject<UUID>(1)

  constructor (
    @Inject(RecentVideosRecommendationService) private recommendations: RecommendationService
  ) {
    this.recommendations$ = this.requestsForLoad$$.pipe(
      switchMap(requestedUUID => fromPromise(recommendations.getRecommendations(requestedUUID)))
    )
    this.hasRecommendations$ = this.recommendations$.pipe(
      map(otherVideos => otherVideos.length > 0)
    )
  }

  requestNewRecommendations (videoUUID: string) {
    this.requestsForLoad$$.next(videoUUID)
  }
}
