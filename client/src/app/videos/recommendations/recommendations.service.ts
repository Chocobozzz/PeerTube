import { Video } from '@app/shared/video/video.model'
import { Observable } from 'rxjs'

export type UUID = string

export interface RecommendationService {
  getRecommendations (uuid: UUID): Observable<Video[]>
}
