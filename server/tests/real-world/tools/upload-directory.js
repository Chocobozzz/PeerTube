'use strict'

const program = require('commander')
const eachSeries = require('async/eachSeries')
const exec = require('child_process').exec
const fs = require('fs')
const path = require('path')

program
  .option('-u, --url <url>', 'Server url')
  .option('-n, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-i, --directory <directory>', 'Videos directory absolute path')
  .option('-d, --description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
  .parse(process.argv)

if (
  !program.url ||
  !program.username ||
  !program.password ||
  !program.directory ||
  !program.description ||
  !program.tags
) {
  throw new Error('All arguments are required.')
}

exec('node ./get-access-token -u "' + program.url + '" -n "' + program.username + '" -p "' + program.password + '"', function (err, stdout) {
  if (err) throw err

  const accessToken = stdout.replace('\n', '')

  fs.readdir(program.directory, function (err, files) {
    if (err) throw err

    eachSeries(files, function (file, callbackEach) {
      const video = {
        tags: program.tags,
        name: file,
        description: program.description
      }

      let command = 'node ./upload'
      command += ' -u "' + program.url + '"'
      command += ' -a "' + accessToken + '"'
      command += ' -n "' + video.name + '"'
      command += ' -d "' + video.description + '"'
      command += ' -t "' + video.tags.join(',') + '"'
      command += ' -f "' + path.join(program.directory, file) + '"'

      exec(command, function (err, stdout) {
        if (err) console.log(err)

        console.log(stdout)

        return callbackEach()
      })
    })
  })
})

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
