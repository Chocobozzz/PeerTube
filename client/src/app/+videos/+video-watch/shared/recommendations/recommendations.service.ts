import { Observable } from 'rxjs'
import { RecommendationInfo } from './recommendation-info.model'
import { Video } from '@app/shared/shared-main/video/video.model'

export interface RecommendationService {
  getRecommendations (recommendation: RecommendationInfo): Observable<Video[]>
}
