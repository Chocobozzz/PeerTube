import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'
import { VideosProvider } from '@app/shared/video/video.service'
import { of } from 'rxjs'
import Mock = jest.Mock

describe('"Recent Videos" Recommender', () => {
  describe('getRecommendations', () => {
    let videosService: VideosProvider
    let service: RecentVideosRecommendationService
    let getVideosMock: Mock<any>
    beforeEach(() => {
      getVideosMock = jest.fn()
      videosService = {
        getVideos: getVideosMock
      }
      service = new RecentVideosRecommendationService(videosService)
    })
    it('should filter out the given UUID from the results', async (done) => {
      const vids = [
        { uuid: 'uuid1' },
        { uuid: 'uuid2' }
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations('uuid1').toPromise()
      const uuids = result.map(v => v.uuid)
      expect(uuids).toEqual(['uuid2'])
      done()
    })
    it('should return 5 results when the given UUID is NOT in the first 5 results', async (done) => {
      const vids = [
        { uuid: 'uuid2' },
        { uuid: 'uuid3' },
        { uuid: 'uuid4' },
        { uuid: 'uuid5' },
        { uuid: 'uuid6' }
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations('uuid1').toPromise()
      expect(result.length).toEqual(5)
      done()
    })
    it('should return 5 results when the given UUID IS PRESENT in the first 5 results', async (done) => {
      const vids = [
        { uuid: 'uuid1' },
        { uuid: 'uuid2' },
        { uuid: 'uuid3' },
        { uuid: 'uuid4' },
        { uuid: 'uuid5' }
      ]
      const vids2 = [
        { uuid: 'uuid6' },
        { uuid: 'uuid7' },
        { uuid: 'uuid8' },
        { uuid: 'uuid9' },
        { uuid: 'uuid10' }
      ]
      getVideosMock
        .mockReturnValueOnce(of({ videos: vids })) // First call
        .mockReturnValueOnce(of({ videos: vids2 })) // 2nd call
      const result = await service.getRecommendations('uuid1').toPromise()
      expect(result.length).toEqual(5)
      done()
    })
  })
})
