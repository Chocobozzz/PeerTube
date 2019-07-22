import { Injectable } from '@angular/core'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { Video } from '@app/shared/video/video.model'
import { RecommendationInfo } from '@app/shared/video/recommendation-info.model'
import { VideoService } from '@app/shared/video/video.service'
import { map, switchMap } from 'rxjs/operators'
import { Observable, of } from 'rxjs'
import { SearchService } from '@app/search/search.service'
import { AdvancedSearch } from '@app/search/advanced-search.model'

/**
 * Provides "recommendations" by providing the most recently uploaded videos.
 */
@Injectable()
export class RecentVideosRecommendationService implements RecommendationService {
  readonly pageSize = 5

  constructor (
    private videos: VideoService,
    private searchService: SearchService
  ) { }

  getRecommendations (recommendation: RecommendationInfo): Observable<Video[]> {
    return this.fetchPage(1, recommendation)
      .pipe(
        map(videos => {
          const otherVideos = videos.filter(v => v.uuid !== recommendation.uuid)
          return otherVideos.slice(0, this.pageSize)
        })
      )
  }

  private fetchPage (page: number, recommendation: RecommendationInfo): Observable<Video[]> {
    const pagination = { currentPage: page, itemsPerPage: this.pageSize + 1 }
    const defaultSubscription = this.videos.getVideos({ videoPagination: pagination, sort: '-createdAt' })
                                    .pipe(map(v => v.data))

    if (!recommendation.tags || recommendation.tags.length === 0) return defaultSubscription

    const params = {
      search: '',
      componentPagination: pagination,
      advancedSearch: new AdvancedSearch({ tagsOneOf: recommendation.tags.join(','), sort: '-createdAt' })
    }

    return this.searchService.searchVideos(params)
               .pipe(
                 map(v => v.data),
                 switchMap(videos => {
                   if (videos.length <= 1) return defaultSubscription

                   return of(videos)
                 })
               )
  }
}
