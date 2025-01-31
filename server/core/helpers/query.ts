import { pick } from '@peertube/peertube-core-utils'
import {
  VideoChannelsSearchQueryAfterSanitize,
  VideoPlaylistsSearchQueryAfterSanitize,
  VideosCommonQueryAfterSanitize,
  VideosSearchQueryAfterSanitize
} from '@peertube/peertube-models'

function pickCommonVideoQuery (query: VideosCommonQueryAfterSanitize) {
  return pick(query, [
    'start',
    'count',
    'sort',
    'nsfw',
    'isLive',
    'categoryOneOf',
    'licenceOneOf',
    'languageOneOf',
    'host',
    'privacyOneOf',
    'tagsOneOf',
    'tagsAllOf',
    'isLocal',
    'include',
    'skipCount',
    'hasHLSFiles',
    'hasWebVideoFiles',
    'search',
    'excludeAlreadyWatched',
    'autoTagOneOf'
  ])
}

function pickSearchVideoQuery (query: VideosSearchQueryAfterSanitize) {
  return {
    ...pickCommonVideoQuery(query),

    ...pick(query, [
      'searchTarget',
      'host',
      'startDate',
      'endDate',
      'originallyPublishedStartDate',
      'originallyPublishedEndDate',
      'durationMin',
      'durationMax',
      'uuids'
    ])
  }
}

function pickSearchChannelQuery (query: VideoChannelsSearchQueryAfterSanitize) {
  return pick(query, [
    'searchTarget',
    'search',
    'start',
    'count',
    'sort',
    'host',
    'handles'
  ])
}

function pickSearchPlaylistQuery (query: VideoPlaylistsSearchQueryAfterSanitize) {
  return pick(query, [
    'searchTarget',
    'search',
    'start',
    'count',
    'sort',
    'host',
    'uuids'
  ])
}

export {
  pickCommonVideoQuery,
  pickSearchVideoQuery,
  pickSearchPlaylistQuery,
  pickSearchChannelQuery
}
