import { MVideoPlaylist } from '@server/types/models/video/video-playlist.js'
import { MVideo } from '@server/types/models/video/video.js'
import { TagsHtml } from './tags-html.js'

export function buildEmptyEmbedHTML (options: {
  html: string
  playlist?: MVideoPlaylist
  video?: MVideo
}) {
  const { html, playlist, video } = options

  let htmlResult = TagsHtml.addTitleTag(html)
  htmlResult = TagsHtml.addDescriptionTag(htmlResult)

  return TagsHtml.addTags(htmlResult, { forbidIndexation: true }, { playlist, video })
}
