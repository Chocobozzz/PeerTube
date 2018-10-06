import { RecommendedVideosStore } from '@app/videos/recommendations/recommended-videos.store'
import { RecommendationService } from '@app/videos/recommendations/recommendations.service'

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
      store.requestNewRecommendations('some-uuid')
      store.requestNewRecommendations('some-uuid')
      // Requests aren't fulfilled until someone asks for them (ie: subscribes)
      store.recommendations$.subscribe()
      expect(service.getRecommendations).toHaveBeenCalledTimes(1)
    })
  })
})
