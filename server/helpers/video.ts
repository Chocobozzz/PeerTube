import { VideoModel } from '../models/video/video'

type VideoFetchType = 'all' | 'only-video' | 'only-video-with-rights' | 'id' | 'none'

function fetchVideo (id: number | string, fetchType: VideoFetchType, userId?: number) {
  if (fetchType === 'all') return VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId)

  if (fetchType === 'only-video-with-rights') return VideoModel.loadWithRights(id)

  if (fetchType === 'only-video') return VideoModel.load(id)

  if (fetchType === 'id' || fetchType === 'none') return VideoModel.loadOnlyId(id)
}

type VideoFetchByUrlType = 'all' | 'only-video'
function fetchVideoByUrl (url: string, fetchType: VideoFetchByUrlType) {
  if (fetchType === 'all') return VideoModel.loadByUrlAndPopulateAccount(url)

  if (fetchType === 'only-video') return VideoModel.loadByUrl(url)
}

export {
  VideoFetchType,
  VideoFetchByUrlType,
  fetchVideo,
  fetchVideoByUrl
}
