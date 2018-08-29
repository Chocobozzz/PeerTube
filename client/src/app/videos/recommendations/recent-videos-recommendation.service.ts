import { Inject, Injectable } from '@angular/core'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { Video } from '@app/shared/video/video.model'
import { VideoService, VideosProvider } from '@app/shared/video/video.service'
import { map, switchMap } from 'rxjs/operators'
import { Observable, of } from 'rxjs'

/**
 * Provides "recommendations" by providing the most recently uploaded videos.
 */
@Injectable()
export class RecentVideosRecommendationService implements RecommendationService {

  readonly pageSize = 5

  constructor (
    @Inject(VideoService) private videos: VideosProvider
  ) {
  }

  getRecommendations (uuid: string): Observable<Video[]> {
    return this.fetchPage(1)
      .pipe(
        switchMap(vids => {
          const otherVideos = vids.filter(v => v.uuid !== uuid)
          let firstFive = otherVideos.slice(0, this.pageSize)
          return of(firstFive)
        })
      )
  }

  private fetchPage (page: number): Observable<Video[]> {
    let pagination = { currentPage: page, itemsPerPage: this.pageSize + 1 }
    return this.videos.getVideos(pagination, '-createdAt')
      .pipe(
        map(v => v.videos)
      )
  }

}
