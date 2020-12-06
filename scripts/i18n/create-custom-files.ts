import { writeJSON } from 'fs-extra'
import { values } from 'lodash'
import { join } from 'path'
import { registerTSPaths } from '../../server/helpers/register-ts-paths'
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
import { I18N_LOCALES } from '../../shared/core-utils/i18n'

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
  'Total uploaded: ': 'Total uploaded: ',
  'From servers: ': 'From servers: ',
  'From peers: ': 'From peers: ',
  'Normal mode': 'Normal mode',
  'Theater mode': 'Theater mode'
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

writeAll().catch(err => {
  console.error(err)
  process.exit(-1)
})

async function writeAll () {
  const localePath = join(__dirname, '../../../client/src/locale')

  await writeJSON(join(localePath, 'player.en-US.json'), playerKeys, { spaces: 4 })
  await writeJSON(join(localePath, 'server.en-US.json'), serverKeys, { spaces: 4 })

  for (const key of Object.keys(I18N_LOCALES)) {
    const playerJsonPath = join(localePath, `player.${key}.json`)
    const translatedPlayer = require(playerJsonPath)

    const newTranslatedPlayer = Object.assign({}, playerKeys, translatedPlayer)
    await writeJSON(playerJsonPath, newTranslatedPlayer, { spaces: 4 })

    const serverJsonPath = join(localePath, `server.${key}.json`)
    const translatedServer = require(serverJsonPath)

    const newTranslatedServer = Object.assign({}, serverKeys, translatedServer)
    await writeJSON(serverJsonPath, newTranslatedServer, { spaces: 4 })
  }
}
