import * as xliff12ToJs from 'xliff/xliff12ToJs'
import { readFileSync, unlink, writeFile } from 'fs'
import { join } from 'path'
import { buildFileLocale, I18N_LOCALES, isDefaultLocale } from '../../shared/models/i18n/i18n'
import { eachSeries } from 'async'

const sources: string[] = []
const availableLocales = Object.keys(I18N_LOCALES)
                               .filter(l => isDefaultLocale(l) === false)
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

    process.exit(0)
  })
})

function handleError (err: any) {
  console.error(err)
  process.exit(-1)
}

function xliffFile2JSON (filePath: string, cb) {
  const fileTarget = filePath.replace('.xml', '.json')

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
