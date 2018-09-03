import { RecentVideosRecommendationService } from '@app/videos/recommendations/recent-videos-recommendation.service'
import { VideosProvider } from '@app/shared/video/video.service'
import { VideoDetails } from '@app/shared/video/video-details.model'
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
      let video1 = new VideoDetails({ uuid: 'uuid1' })
      let video2 = new VideoDetails({ uuid: 'uuid2' })
      const vids = [
        video1,
        video2
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations(video1).toPromise()
      const uuids = result.map(v => v.uuid)
      expect(uuids).toEqual([video2])
      done()
    })
    it('should return 5 results when the given UUID is NOT in the first 5 results', async (done) => {
      let video1 = new VideoDetails({ uuid: 'uuid1' })
      let video2 = new VideoDetails({ uuid: 'uuid2' })
      let video3 = new VideoDetails({ uuid: 'uuid3' })
      let video4 = new VideoDetails({ uuid: 'uuid4' })
      let video5 = new VideoDetails({ uuid: 'uuid5' })
      let video6 = new VideoDetails({ uuid: 'uuid6' })
      let video7 = new VideoDetails({ uuid: 'uuid7' })
      const vids = [
        video2,
        video3,
        video4,
        video5,
        video6,
        video7
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations(video1).toPromise()
      expect(result.length).toEqual(5)
      done()
    })
    it('should return 5 results when the given UUID IS PRESENT in the first 5 results', async (done) => {
      let video1 = new VideoDetails({ uuid: 'uuid1' })
      let video2 = new VideoDetails({ uuid: 'uuid2' })
      let video3 = new VideoDetails({ uuid: 'uuid3' })
      let video4 = new VideoDetails({ uuid: 'uuid4' })
      let video5 = new VideoDetails({ uuid: 'uuid5' })
      let video6 = new VideoDetails({ uuid: 'uuid6' })
      const vids = [
        video1,
        video2,
        video3,
        video4,
        video5,
        video6
      ]
      getVideosMock.mockReturnValueOnce(of({ videos: vids }))
      const result = await service.getRecommendations(video1).toPromise()
      expect(result.length).toEqual(5)
      done()
    })
    it('should fetch an extra result in case the given UUID is in the list', async (done) => {
      await service.getRecommendations(new VideoDetails({ uuid: 'uuid1' })).toPromise()
      let expectedSize = service.pageSize + 1
      let params = { currentPage: jasmine.anything(), itemsPerPage: expectedSize }
      expect(getVideosMock).toHaveBeenCalledWith(params, jasmine.anything())
      done()
    })
  })
})
