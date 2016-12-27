#!/usr/bin/env node

'use strict'

// TODO: document this script

const program = require('commander')
const eachSeries = require('async/eachSeries')
const series = require('async/series')
const waterfall = require('async/waterfall')
const fs = require('fs')
const path = require('path')
const MongoClient = require('mongodb').MongoClient

const constants = require('../server/initializers/constants')

program
  .option('-mh, --mongo-host [host]', 'MongoDB host', 'localhost')
  .option('-mp, --mongo-port [weight]', 'MongoDB port', '27017')
  .option('-md, --mongo-database [dbname]', 'MongoDB database')
  .parse(process.argv)

if (!program.mongoDatabase) {
  console.error('The mongodb database is mandatory.')
  process.exit(-1)
}

const mongoUrl = 'mongodb://' + program.mongoHost + ':' + program.mongoPort + '/' + program.mongoDatabase
const dbSequelize = require('../server/initializers/database')

console.log('Connecting to ' + mongoUrl)
MongoClient.connect(mongoUrl, function (err, dbMongo) {
  if (err) throw err

  console.log('Connected to ' + mongoUrl)

  const videoMongo = dbMongo.collection('videos')
  const userMongo = dbMongo.collection('users')
  const podMongo = dbMongo.collection('pods')

  podMongo.count(function (err, podsLength) {
    if (err) throw err

    if (podsLength > 0) {
      console.error('You need to quit friends first.')
      process.exit(-1)
    }

    console.log('Connecting to ' + dbSequelize.sequelize.config.database)
    dbSequelize.init(true, function (err) {
      if (err) throw err

      console.log('Connected to SQL database %s.', dbSequelize.sequelize.config.database)

      series([
        function (next) {
          dbSequelize.sequelize.sync({ force: true }).asCallback(next)
        },

        function (next) {
          migrateVideos(videoMongo, dbSequelize, next)
        },

        function (next) {
          migrateUsers(userMongo, dbSequelize, next)
        }
      ], function (err) {
        if (err) console.error(err)

        process.exit(0)
      })
    })
  })
})

// ---------------------------------------------------------------------------

function migrateUsers (userMongo, dbSequelize, callback) {
  userMongo.find().toArray(function (err, mongoUsers) {
    if (err) return callback(err)

    eachSeries(mongoUsers, function (mongoUser, callbackEach) {
      console.log('Migrating user %s', mongoUser.username)

      const userData = {
        username: mongoUser.username,
        password: mongoUser.password,
        role: mongoUser.role
      }
      const options = {
        hooks: false
      }

      dbSequelize.User.create(userData, options).asCallback(callbackEach)
    }, callback)
  })
}

function migrateVideos (videoMongo, dbSequelize, finalCallback) {
  videoMongo.find().toArray(function (err, mongoVideos) {
    if (err) return finalCallback(err)

    eachSeries(mongoVideos, function (mongoVideo, callbackEach) {
      console.log('Migrating video %s.', mongoVideo.name)

      waterfall([

        function startTransaction (callback) {
          dbSequelize.sequelize.transaction().asCallback(function (err, t) {
            return callback(err, t)
          })
        },

        function findOrCreatePod (t, callback) {
          if (mongoVideo.remoteId === null) return callback(null, t, null)

          const query = {
            where: {
              host: mongoVideo.podHost
            },
            defaults: {
              host: mongoVideo.podHost
            },
            transaction: t
          }

          dbSequelize.Pod.findOrCreate(query).asCallback(function (err, result) {
            // [ instance, wasCreated ]
            return callback(err, t, result[0])
          })
        },

        function findOrCreateAuthor (t, pod, callback) {
          const podId = pod ? pod.id : null
          const username = mongoVideo.author

          const query = {
            where: {
              podId,
              name: username
            },
            defaults: {
              podId,
              name: username
            },
            transaction: t
          }

          dbSequelize.Author.findOrCreate(query).asCallback(function (err, result) {
            // [ instance, wasCreated ]
            return callback(err, t, result[0])
          })
        },

        function findOrCreateTags (t, author, callback) {
          const tags = mongoVideo.tags
          const tagInstances = []

          eachSeries(tags, function (tag, callbackEach) {
            const query = {
              where: {
                name: tag
              },
              defaults: {
                name: tag
              },
              transaction: t
            }

            dbSequelize.Tag.findOrCreate(query).asCallback(function (err, res) {
              if (err) return callbackEach(err)

              // res = [ tag, isCreated ]
              const tag = res[0]
              tagInstances.push(tag)
              return callbackEach()
            })
          }, function (err) {
            return callback(err, t, author, tagInstances)
          })
        },

        function createVideoObject (t, author, tagInstances, callback) {
          const videoData = {
            name: mongoVideo.name,
            remoteId: mongoVideo.remoteId,
            extname: mongoVideo.extname,
            infoHash: mongoVideo.magnet.infoHash,
            description: mongoVideo.description,
            authorId: author.id,
            duration: mongoVideo.duration,
            createdAt: mongoVideo.createdDate
          }

          const video = dbSequelize.Video.build(videoData)

          return callback(null, t, tagInstances, video)
        },

        function moveVideoFile (t, tagInstances, video, callback) {
          const basePath = constants.CONFIG.STORAGE.VIDEOS_DIR
          const src = path.join(basePath, mongoVideo._id.toString()) + video.extname
          const dst = path.join(basePath, video.id) + video.extname
          fs.rename(src, dst, function (err) {
            if (err) return callback(err)

            return callback(null, t, tagInstances, video)
          })
        },

        function insertVideoIntoDB (t, tagInstances, video, callback) {
          const options = {
            transaction: t
          }

          video.save(options).asCallback(function (err, videoCreated) {
            return callback(err, t, tagInstances, videoCreated)
          })
        },

        function associateTagsToVideo (t, tagInstances, video, callback) {
          const options = { transaction: t }

          video.setTags(tagInstances, options).asCallback(function (err) {
            return callback(err, t)
          })
        }

      ], function (err, t) {
        if (err) {
          // Abort transaction?
          if (t) t.rollback()

          return callbackEach(err)
        }

        // Commit transaction
        t.commit()

        return callbackEach()
      })
    }, finalCallback)
  })
}
