import { Inject, Injectable } from '@angular/core'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { Video } from '@app/shared/video/video.model'
import { VideoDetails } from '@app/shared/video/video-details.model'
import { VideoService } from '@app/shared/video/video.service'
import { map } from 'rxjs/operators'
import { Observable } from 'rxjs'
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
  ) {
  }

  getRecommendations (video: VideoDetails): Observable<Video[]> {
    return this.fetchPage(1, video)
      .pipe(
        map(vids => {
          const otherVideos = vids.filter(v => v.uuid !== video.uuid)
          return otherVideos.slice(0, this.pageSize)
        })
      )
  }

  private fetchPage (page: number, video: VideoDetails): Observable<Video[]> {
    let pagination = { currentPage: page, itemsPerPage: this.pageSize + 1 }
    if (video.tags.length === 0) {
      return this.videos.getVideos(pagination, '-createdAt')
        .pipe(
          map(v => v.videos)
        )
    }
    return this.searchService.searchVideos('',
      pagination,
      new AdvancedSearch({ tagsOneOf: video.tags.join(','), sort: '-createdAt' })
    ).pipe(
      map(v => v.videos)
    )
  }

}
