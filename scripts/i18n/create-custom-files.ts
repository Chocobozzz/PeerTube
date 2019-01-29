import * as jsToXliff12 from 'xliff/jsToXliff12'
import { writeFile } from 'fs-extra'
import { join } from 'path'
import {
  buildLanguages,
  VIDEO_CATEGORIES,
  VIDEO_IMPORT_STATES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES
} from '../../server/initializers/constants'
import { values } from 'lodash'

type TranslationType = {
  target: string
  data: { [id: string]: string }
}

const videojs = require(join(__dirname, '../../../client/src/locale/source/videojs_en_US.json'))
const playerKeys = {
  'Quality': 'Quality',
  'Auto': 'Auto',
  'Speed': 'Speed',
  'Subtitles/CC': 'Subtitles/CC',
  'peers': 'peers',
  'peer': 'peer',
  'Go to the video page': 'Go to the video page',
  'Settings': 'Settings',
  'Uses P2P, others may know you are watching this video.': 'Uses P2P, others may know you are watching this video.',
  'Copy the video URL': 'Copy the video URL',
  'Copy the video URL at the current time': 'Copy the video URL at the current time',
  'Copy embed code': 'Copy embed code',
  'Total downloaded: ': 'Total downloaded: ',
  'Total uploaded: ': 'Total uploaded: '
}
const playerTranslations = {
  target: join(__dirname, '../../../client/src/locale/source/player_en_US.xml'),
  data: Object.assign({}, videojs, playerKeys)
}

// Server keys
const serverKeys: any = {}
values(VIDEO_CATEGORIES)
  .concat(values(VIDEO_LICENCES))
  .concat(values(VIDEO_PRIVACIES))
  .concat(values(VIDEO_STATES))
  .concat(values(VIDEO_IMPORT_STATES))
  .concat([
    'This video does not exist.',
    'We cannot fetch the video. Please try again later.',
    'Sorry',
    'This video is not available because the remote instance is not responding.'
  ])
  .forEach(v => serverKeys[v] = v)

// More keys
Object.assign(serverKeys, {
  'Misc': 'Misc',
  'Unknown': 'Unknown'
})

const serverTranslations = {
  target: join(__dirname, '../../../client/src/locale/source/server_en_US.xml'),
  data: serverKeys
}

// ISO 639 keys
const languageKeys: any = {}
const languages = buildLanguages()
Object.keys(languages).forEach(k => languageKeys[languages[k]] = languages[k])

const iso639Translations = {
  target: join(__dirname, '../../../client/src/locale/source/iso639_en_US.xml'),
  data: languageKeys
}

saveToXliffFile(playerTranslations, err => {
  if (err) return handleError(err)

  saveToXliffFile(serverTranslations, err => {
    if (err) return handleError(err)

    saveToXliffFile(iso639Translations, err => {
      if (err) return handleError(err)

      process.exit(0)
    })
  })
})

// Then, the server strings

function saveToXliffFile (jsonTranslations: TranslationType, cb: Function) {
  const obj = {
    resources: {
      namespace1: {}
    }
  }
  Object.keys(jsonTranslations.data).forEach(k => obj.resources.namespace1[ k ] = { source: jsonTranslations.data[ k ] })

  jsToXliff12(obj, (err, res) => {
    if (err) return cb(err)

    writeFile(jsonTranslations.target, res, err => {
      if (err) return cb(err)

      return cb(null)
    })
  })
}

function handleError (err: any) {
  console.error(err)
  process.exit(-1)
}
