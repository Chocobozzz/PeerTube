import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'
import { VideoDetails } from '@app/shared/video/video-details.model'

describe('RecommendedVideosStore', () => {
  describe('requestNewRecommendations', () => {
    let store: RecommendedVideosStore
    let service: RecommendationService
    beforeEach(() => {
      service = {
        getRecommendations: jest.fn(() => new Promise((r) => r()))
      }
      store = new RecommendedVideosStore(service)
    })
    it('should pull new videos from the service one time when given the same UUID twice', () => {
      let video1 = new VideoDetails({ uuid: 'uuid1' })
      store.requestNewRecommendations(video1)
      store.requestNewRecommendations(video1)
      // Requests aren't fulfilled until someone asks for them (ie: subscribes)
      store.recommendations$.subscribe()
      expect(service.getRecommendations).toHaveBeenCalledTimes(1)
    })
  })
})
