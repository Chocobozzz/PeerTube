import { Injectable, inject } from '@angular/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { Observable, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'

@Injectable()
export class VideoRecommendationService {
  private videos = inject(VideoService)

  // Must not exceed the server limit
  private static readonly MAX_EXCLUDED_VIDEOS = 50

  private readonly videoIdsHistory = new Set<number>()

  getRecommendationHistory () {
    return this.videoIdsHistory
  }

  getRecommendations (currentVideo: VideoDetails, videoPassword?: string, exceptions = new Set<number>()): Observable<Video[]> {
    this.videoIdsHistory.add(currentVideo.id)

    // Most recent viewed videos are excluded first
    const excludeVideoIds = Array.from(exceptions)
      .filter(id => id !== currentVideo.id)
      .slice(-VideoRecommendationService.MAX_EXCLUDED_VIDEOS)

    const fetch = (excludeVideoIds: number[]) => {
      // The server applies the recommendation scope of the video
      return this.videos.listRecommendationVideos({
        videoId: currentVideo.uuid,
        videoPassword,
        count: 5,
        excludeVideoIds
      }).pipe(map(v => v.data))
    }

    return fetch(excludeVideoIds)
      .pipe(
        switchMap(videos => {
          // Stop using exclude list if we excluded all videos
          if (videos.length === 0 && excludeVideoIds.length !== 0) return fetch([])

          return of(videos)
        })
      )
  }
}
