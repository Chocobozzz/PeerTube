export const FIXTURE_URLS = {
  peertubeLong: 'https://peertube2.cpy.re/videos/watch/122d093a-1ede-43bd-bd34-59d2931ffc5e',
  peertubeShort: 'https://peertube2.cpy.re/w/3fbif9S3WmtTP8gGsC5HBd',

  youtube: 'https://www.youtube.com/watch?v=msX3jv1XdvM',
  youtubeChapters: 'https://www.youtube.com/watch?v=TL9P-Er7ils',

  /**
   * The video is used to check format-selection correctness wrt. HDR,
   * which brings its own set of oddities outside of a MediaSource.
   *
   * The video needs to have the following format_ids:
   * (which you can check by using `youtube-dl <url> -F`):
   * - (webm vp9)
   * - (mp4 avc1)
   * - (webm vp9.2 HDR)
   */
  youtubeHDR: 'https://www.youtube.com/watch?v=RQgnBB9z_N4',

  youtubeChannel: 'https://youtube.com/channel/UCtnlZdXv3-xQzxiqfn6cjIA',
  youtubePlaylist: 'https://youtube.com/playlist?list=PLRGXHPrcPd2yc2KdswlAWOxIJ8G3vgy4h',

  // eslint-disable-next-line max-len
  magnet: 'magnet:?xs=https%3A%2F%2Fpeertube2.cpy.re%2Flazy-static%2Ftorrents%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.torrent&xt=urn:btih:0f498834733e8057ed5c6f2ee2b4efd8d84a76ee&dn=super+peertube2+video&tr=https%3A%2F%2Fpeertube2.cpy.re%2Ftracker%2Fannounce&tr=wss%3A%2F%2Fpeertube2.cpy.re%3A443%2Ftracker%2Fsocket&ws=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Fwebseed%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.mp4',

  badVideo: 'https://download.cpy.re/peertube/bad_video.mp4',
  goodVideo: 'https://download.cpy.re/peertube/good_video.mp4',
  goodVideo720: 'https://download.cpy.re/peertube/good_video_720.mp4',
  transcriptionVideo: 'https://download.cpy.re/peertube/the_last_man_on_earth.mp4',

  chatersVideo: 'https://download.cpy.re/peertube/video_chapters.mp4',

  file4K: 'https://download.cpy.re/peertube/4k_file.txt',

  transcriptionModels: 'https://download.cpy.re/peertube/transcription-models.zip'
}
