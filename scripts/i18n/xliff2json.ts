import { registerTSPaths } from '../../server/helpers/register-ts-paths'
registerTSPaths()

import * as xliff12ToJs from 'xliff/xliff12ToJs'
import { readFileSync, readJSON, unlink, writeFile, writeJSON, existsSync, exists, pathExists } from 'fs-extra'
import { join } from 'path'
import { buildFileLocale, I18N_LOCALES, isDefaultLocale } from '../../shared/models/i18n/i18n'
import { eachSeries } from 'async'

const sources: string[] = []
const l = [
  'ar-001',
  'ca-ES',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'en-GB',
  'en-US',
  'eo',
  'es-ES',
  'eu-ES',
  'fa-IR',
  'fi-FI',
  'fr-FR',
  'gd',
  'gl-ES',
  'hu-HU',
  'it-IT',
  'ja-JP',
  'jbo',
  'ko-KR',
  'lt-LT',
  'nb-NO',
  'nl-NL',
  'oc',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ru-RU',
  'sk-SK',
  'sl-SI',
  'sv-SE',
  'ta',
  'th-TH',
  'tr-TR',
  'uk-UA',
  'vi-VN',
  'zh-Hans-CN',
  'zh-Hant-TW'
]

const availableLocales = l.filter(l => isDefaultLocale(l) === false)
                               .map(l => buildFileLocale(l))

for (const file of [ 'player', 'server', 'iso639' ]) {
  for (const locale of availableLocales) {
    sources.push(join(__dirname, '../../../client/src/locale/target/', `${file}_${locale}.xml`))
  }
}

eachSeries(sources, (source, cb) => {
  xliffFile2JSON(source, cb)
}, err => {
  if (err) return handleError(err)

  mergeISO639InServer(err => {
    if (err) return handleError(err)

    injectMissingTranslations().then(() => process.exit(0))
  })
})

function handleError (err: any) {
  console.error(err)
  process.exit(-1)
}

function xliffFile2JSON (filePath: string, cb) {
  const fileTarget = filePath.replace('.xml', '.json')

  if (!existsSync(filePath)) {
    console.log('No file %s exists.', filePath)
    return cb()
  }

  // Remove the two first lines our xliff module does not like
  let fileContent = readFileSync(filePath).toString()
  fileContent = removeFirstLine(fileContent)
  fileContent = removeFirstLine(fileContent)

  xliff12ToJs(fileContent, (err, res) => {
    if (err) return cb(err)

    const json = createJSONString(res)
    writeFile(fileTarget, json, err => {
      if (err) return cb(err)

      return unlink(filePath, cb)
    })
  })
}

function mergeISO639InServer (cb) {
  eachSeries(availableLocales, (locale, eachCallback) => {
    const serverPath = join(__dirname, '../../../client/src/locale/target/', `server_${locale}.json`)
    const iso639Path = join(__dirname, '../../../client/src/locale/target/', `iso639_${locale}.json`)

    if (!existsSync(serverPath)) {
      console.log('No file %s exists.', serverPath)
      return cb()
    }
    if (!existsSync(iso639Path)) {
      console.log('No file %s exists.', iso639Path)
      return cb()
    }

    const resServer = readFileSync(serverPath).toString()
    const resISO639 = readFileSync(iso639Path).toString()

    const jsonServer = JSON.parse(resServer)
    const jsonISO639 = JSON.parse(resISO639)

    Object.assign(jsonServer, jsonISO639)
    const serverString = JSON.stringify(jsonServer)

    writeFile(serverPath, serverString, err => {
      if (err) return eachCallback(err)

      return unlink(iso639Path, eachCallback)
    })
  }, cb)
}

function removeFirstLine (str: string) {
  return str.substring(str.indexOf('\n') + 1)
}

function createJSONString (obj: any) {
  const res: any = {}
  const strings = obj.resources['']

  Object.keys(strings).forEach(k => res[k] = strings[k].target)

  return JSON.stringify(res)
}

async function injectMissingTranslations () {
  const baseServer = await readJSON(join(__dirname, '../../../client/src/locale/server.en-US.json'))
  Object.keys(baseServer).forEach(k => baseServer[k] = '')

  for (const locale of availableLocales) {
    const serverPath = join(__dirname, '../../../client/src/locale/target/', `server_${locale}.json`)
    if (!await pathExists(serverPath)) {
      console.log('No file exists to inject missing translations: %s.', serverPath)
      continue
    }

    let serverJSON = await readJSON(serverPath)

    serverJSON = Object.assign({}, baseServer, serverJSON)
    await writeJSON(serverPath, serverJSON)
  }

  const basePlayer = await readJSON(join(__dirname, '../../../client/src/locale/player.en-US.json'))
  Object.keys(basePlayer).forEach(k => basePlayer[k] = '')
  for (const locale of availableLocales) {
    const serverPath = join(__dirname, '../../../client/src/locale/target/', `player_${locale}.json`)
    if (!await pathExists(serverPath)) {
      console.log('No file exists to inject missing translations: %s.', serverPath)
      continue
    }

    let serverJSON = await readJSON(serverPath)

    serverJSON = Object.assign({}, basePlayer, serverJSON)
    await writeJSON(serverPath, serverJSON)
  }
}
