import { pick } from '@shared/core-utils'
import {
  VideoChannelsSearchQueryAfterSanitize,
  VideoPlaylistsSearchQueryAfterSanitize,
  VideosCommonQueryAfterSanitize,
  VideosSearchQueryAfterSanitize
} from '@shared/models'

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
    'privacyOneOf',
    'tagsOneOf',
    'tagsAllOf',
    'isLocal',
    'include',
    'skipCount',
    'hasHLSFiles',
    'hasWebtorrentFiles',
    'search'
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
