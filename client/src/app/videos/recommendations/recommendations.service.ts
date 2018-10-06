import { Video } from '@app/shared/video/video.model'
import { RecommendationInfo } from '@app/shared/video/recommendation-info.model'
import { Observable } from 'rxjs'

export interface RecommendationService {
  getRecommendations (recommendation: RecommendationInfo): Observable<Video[]>
}
