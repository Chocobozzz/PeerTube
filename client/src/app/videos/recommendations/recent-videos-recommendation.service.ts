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

  private readonly pageSize = 5

  constructor (
    @Inject(VideoService) private videos: VideosProvider
  ) {
  }

  getRecommendations (uuid: string): Promise<Video[]> {
    return this.fetchPage(1)
      .pipe(
        switchMap(vids => {
          const otherVideos = vids.filter(v => v.uuid !== uuid)
          if (vids.length === 5 && vids.length !== otherVideos.length) {
            return this.addMoreVids(otherVideos)
          }
          return of(otherVideos)
        })
      ).toPromise()
  }

  private addMoreVids (alreadyFetched: Video[]): Observable<Video[]> {
    return this.fetchPage(2).pipe(
      map(moreVids => {
        alreadyFetched.push(moreVids[0])
        return alreadyFetched
      })
    )
  }

  private fetchPage (page: number): Observable<Video[]> {
    let pagination = { currentPage: page, itemsPerPage: this.pageSize }
    return this.videos.getVideos(pagination, '-createdAt')
      .pipe(
        map(v => v.videos)
      )
  }

}
