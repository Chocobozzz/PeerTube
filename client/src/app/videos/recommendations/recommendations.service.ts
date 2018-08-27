import { Video } from '@app/shared/video/video.model'

export interface RecommendationService {
  getRecommendations (uuid: string): Promise<Video[]>
}
