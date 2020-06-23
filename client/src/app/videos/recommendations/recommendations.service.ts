import { Observable } from 'rxjs'
import { Video } from '@app/shared/shared-main'
import { RecommendationInfo } from './recommendation-info.model'

export interface RecommendationService {
  getRecommendations (recommendation: RecommendationInfo): Observable<Video[]>
}
