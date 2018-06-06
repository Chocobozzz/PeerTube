import * as jsToXliff12 from 'xliff/jsToXliff12'
import { writeFile } from 'fs'
import { join } from 'path'

// First, the player
const playerSource = join(__dirname, '../../../client/src/locale/source/videojs_en_US.json')
const playerTarget = join(__dirname, '../../../client/src/locale/source/player_en_US.xml')

const videojs = require(playerSource)
const playerKeys = {
  'Quality': 'Quality',
  'Auto': 'Auto',
  'Speed': 'Speed',
  'peers': 'peers',
  'Go to the video page': 'Go to the video page',
  'Settings': 'Settings',
  'Uses P2P, others may know you are watching this video.': 'Uses P2P, others may know you are watching this video.',
  'Copy the video URL': 'Copy the video URL',
  'Copy the video URL at the current time': 'Copy the video URL at the current time',
  'Copy embed code': 'Copy embed code'
}

const obj = {
  resources: {
    namespace1: {}
  }
}

for (const sourceObject of [ videojs, playerKeys ]) {
  Object.keys(sourceObject).forEach(k => obj.resources.namespace1[ k ] = { source: sourceObject[ k ] })
}

jsToXliff12(obj, (err, res) => {
  if (err) {
    console.error(err)
    process.exit(-1)
  }

  writeFile(playerTarget, res, err => {
    if (err) {
      console.error(err)
      process.exit(-1)
    }

    process.exit(0)
  })
})

// Then, the server strings
