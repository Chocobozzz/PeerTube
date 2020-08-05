import { registerTSPaths } from '../../server/helpers/register-ts-paths'
import { writeJSON } from 'fs-extra'
import { join } from 'path'
import {
  buildLanguages,
  VIDEO_CATEGORIES,
  VIDEO_IMPORT_STATES,
  VIDEO_LICENCES,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PLAYLIST_TYPES,
  VIDEO_PRIVACIES,
  VIDEO_STATES
} from '../../server/initializers/constants'
import { values } from 'lodash'

registerTSPaths()

const videojs = require(join(__dirname, '../../../client/src/locale/videojs.en-US.json'))
const playerKeys = {
  'Quality': 'Quality',
  'Auto': 'Auto',
  'Speed': 'Speed',
  'Subtitles/CC': 'Subtitles/CC',
  'peers': 'peers',
  'peer': 'peer',
  'Go to the video page': 'Go to the video page',
  'Settings': 'Settings',
  'Watching this video may reveal your IP address to others.': 'Watching this video may reveal your IP address to others.',
  'Copy the video URL': 'Copy the video URL',
  'Copy the video URL at the current time': 'Copy the video URL at the current time',
  'Copy embed code': 'Copy embed code',
  'Copy magnet URI': 'Copy magnet URI',
  'Total downloaded: ': 'Total downloaded: ',
  'Total uploaded: ': 'Total uploaded: '
}
Object.assign(playerKeys, videojs)

// Server keys
const serverKeys: any = {}
values(VIDEO_CATEGORIES)
  .concat(values(VIDEO_LICENCES))
  .concat(values(VIDEO_PRIVACIES))
  .concat(values(VIDEO_STATES))
  .concat(values(VIDEO_IMPORT_STATES))
  .concat(values(VIDEO_PLAYLIST_PRIVACIES))
  .concat(values(VIDEO_PLAYLIST_TYPES))
  .concat([
    'This video does not exist.',
    'We cannot fetch the video. Please try again later.',
    'Sorry',
    'This video is not available because the remote instance is not responding.',
    'This playlist does not exist',
    'We cannot fetch the playlist. Please try again later.',
    'Playlist: {1}',
    'By {1}',
    'Unavailable video'
  ])
  .forEach(v => { serverKeys[v] = v })

// More keys
Object.assign(serverKeys, {
  Misc: 'Misc',
  Unknown: 'Unknown'
})

// ISO 639 keys
const languageKeys: any = {}
const languages = buildLanguages()
Object.keys(languages).forEach(k => { languageKeys[languages[k]] = languages[k] })

Object.assign(serverKeys, languageKeys)

Promise.all([
  writeJSON(join(__dirname, '../../../client/src/locale/player.en-US.json'), playerKeys),
  writeJSON(join(__dirname, '../../../client/src/locale/server.en-US.json'), serverKeys)
]).catch(err => {
  console.error(err)
  process.exit(-1)
})
