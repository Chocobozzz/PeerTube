/*
  Use remote id as identifier
*/

const map = require('lodash/map')
const mongoose = require('mongoose')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const logger = require('../../helpers/logger')
const friends = require('../../lib/friends')

const Pod = mongoose.model('Pod')
const Video = mongoose.model('Video')

exports.up = function (callback) {
  Pod.find({}).lean().exec(function (err, pods) {
    if (err) return callback(err)

    // We need to quit friends first
    if (pods.length === 0) {
      return setVideosRemoteId(callback)
    }

    const timeout = setTimeout(function () {
      throw new Error('You need to enter a value!')
    }, 10000)

    rl.question('I am sorry but I need to quit friends for upgrading. Do you want to continue? (yes/*)', function (answer) {
      if (answer !== 'yes') throw new Error('I cannot continue.')

      clearTimeout(timeout)
      rl.close()

      const urls = map(pods, 'url')
      logger.info('Saying goodbye to: ' + urls.join(', '))

      setVideosRemoteId(function () {
        friends.quitFriends(callback)
      })
    })
  })
}

exports.down = function (callback) {
  throw new Error('Not implemented.')
}

function setVideosRemoteId (callback) {
  Video.update({ filename: { $ne: null } }, { remoteId: null }, function (err) {
    if (err) throw err

    Video.update({ filename: null }, { remoteId: mongoose.Types.ObjectId() }, callback)
  })
}
