import { Video } from '@app/shared/video/video.model'
import { VideoDetails } from '@app/shared/video/video-details.model'
import { Observable } from 'rxjs'

export type UUID = string

export interface RecommendationService {
  getRecommendations (video: VideoDetails): Observable<Video[]>
}
