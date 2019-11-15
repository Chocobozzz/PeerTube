import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/typings/models'

function extractVideo (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
  return isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist
}

export {
  extractVideo
}
