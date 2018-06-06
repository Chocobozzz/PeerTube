import * as xliff12ToJs from 'xliff/xliff12ToJs'
import { readFileSync, writeFile } from 'fs'
import { join } from 'path'

// First, the player
const playerSource = join(__dirname, '../../../client/src/locale/target/player_fr.xml')
const playerTarget = join(__dirname, '../../../client/src/locale/target/player_fr.json')

// Remove the two first lines our xliff module does not like
let playerFile = readFileSync(playerSource).toString()
playerFile = removeFirstLine(playerFile)
playerFile = removeFirstLine(playerFile)

xliff12ToJs(playerFile, (err, res) => {
  if (err) {
    console.error(err)
    process.exit(-1)
  }

  const json = createJSONString(res)
  writeFile(playerTarget, json, err => {
    if (err) {
      console.error(err)
      process.exit(-1)
    }

    process.exit(0)
  })
})

function removeFirstLine (str: string) {
  return str.substring(str.indexOf('\n') + 1)
}

function createJSONString (obj: any) {
  const res: any = {}
  const strings = obj.resources['']

  Object.keys(strings).forEach(k => res[k] = strings[k].target)

  return JSON.stringify(res)
}
