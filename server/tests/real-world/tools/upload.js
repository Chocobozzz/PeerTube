'use strict'

const program = require('commander')
const fs = require('fs')

const utils = require('../../utils/videos')

program
  .option('-u, --url <url>', 'Server url')
  .option('-a, --access-token <token>', 'Access token')
  .option('-n, --name <name>', 'Video name')
  .option('-c, --category <category number>', 'Category number')
  .option('-l, --licence <licence number>', 'Licence number')
  .option('-d, --description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
  .option('-f, --file <file>', 'Video absolute file path')
  .parse(process.argv)

if (
  !program.url ||
  !program.accessToken ||
  !program.name ||
  !program.category ||
  !program.licence ||
  !program.description ||
  !program.tags ||
  !Array.isArray(program.tags) ||
  program.tags.length === 0 ||
  !program.file
) {
  throw new Error('All arguments are required.')
}

fs.access(program.file, fs.F_OK, function (err) {
  if (err) throw err

  upload(
    program.url,
    program.accessToken,
    program.name,
    program.category,
    program.licence,
    program.description,
    program.tags,
    program.file
  )
})

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}

function upload (url, accessToken, name, category, licence, description, tags, fixture) {
  console.log('Uploading %s video...', program.name)

  const videoAttributes = {
    name,
    category,
    licence,
    description,
    tags,
    fixture
  }
  utils.uploadVideo(url, accessToken, videoAttributes, function (err) {
    if (err) throw err

    console.log('Video uploaded.')
  })
}
