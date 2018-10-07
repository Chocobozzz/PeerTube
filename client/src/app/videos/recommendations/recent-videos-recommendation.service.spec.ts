import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'
import { VideosProvider } from '@app/shared/video/video.service'
import { EMPTY, of } from 'rxjs'
import Mock = jest.Mock

describe('"Recent Videos" Recommender', () => {
  describe('getRecommendations', () => {
    let videosService: VideosProvider
    let service: RecentVideosRecommendationService
    let getVideosMock: Mock<any>
    beforeEach(() => {
      getVideosMock = jest.fn(() => EMPTY)
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
      const result = await service.getRecommendations({ uuid: 'uuid1' }).toPromise()
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
        { uuid: 'uuid6' },
        { uuid: 'uuid7' }
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations({ uuid: 'uuid1' }).toPromise()
      expect(result.length).toEqual(5)
      done()
    })
    it('should return 5 results when the given UUID IS PRESENT in the first 5 results', async (done) => {
      const vids = [
        { uuid: 'uuid1' },
        { uuid: 'uuid2' },
        { uuid: 'uuid3' },
        { uuid: 'uuid4' },
        { uuid: 'uuid5' },
        { uuid: 'uuid6' }
      ]
      getVideosMock
        .mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations({ uuid: 'uuid1' }).toPromise()
      expect(result.length).toEqual(5)
      done()
    })
    it('should fetch an extra result in case the given UUID is in the list', async (done) => {
      await service.getRecommendations({ uuid: 'uuid1' }).toPromise()
      let expectedSize = service.pageSize + 1
      let params = { currentPage: jasmine.anything(), itemsPerPage: expectedSize }
      expect(getVideosMock).toHaveBeenCalledWith(params, jasmine.anything())
      done()
    })
  })
})
