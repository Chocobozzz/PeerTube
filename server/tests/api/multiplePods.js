'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')

const utils = require('./utils')
const webtorrent = require(pathUtils.join(__dirname, '../../lib/webtorrent'))
webtorrent.silent = true

describe('Test multiple pods', function () {
  let servers = []
  const toRemove = []

  before(function (done) {
    this.timeout(30000)

    async.series([
      // Run servers
      function (next) {
        utils.flushAndRunMultipleServers(3, function (serversRun) {
          servers = serversRun
          next()
        })
      },
      // Get the access tokens
      function (next) {
        async.each(servers, function (server, callbackEach) {
          utils.loginAndGetAccessToken(server, function (err, accessToken) {
            if (err) return callbackEach(err)

            server.accessToken = accessToken
            callbackEach()
          })
        }, next)
      },
      // The second pod make friend with the third
      function (next) {
        const server = servers[1]
        utils.makeFriends(server.url, server.accessToken, next)
      },
      // Wait for the request between pods
      function (next) {
        setTimeout(next, 10000)
      },
      // Pod 1 make friends too
      function (next) {
        const server = servers[0]
        utils.makeFriends(server.url, server.accessToken, next)
      },
      function (next) {
        webtorrent.create({ host: 'client', port: '1' }, next)
      }
    ], done)
  })

  it('Should not have videos for all pods', function (done) {
    async.each(servers, function (server, callback) {
      utils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(0)

        callback()
      })
    }, done)
  })

  describe('Should upload the video and propagate on each pod', function () {
    it('Should upload the video on pod 1 and propagate on each pod', function (done) {
      this.timeout(15000)

      async.series([
        function (next) {
          const name = 'my super name for pod 1'
          const description = 'my super description for pod 1'
          const tags = [ 'tag1p1', 'tag2p1' ]
          const file = 'video_short1.webm'
          utils.uploadVideo(servers[0].url, servers[0].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          async.each(servers, function (server, callback) {
            let baseMagnet = null

            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(1)
              const video = videos[0]
              expect(video.name).to.equal('my super name for pod 1')
              expect(video.description).to.equal('my super description for pod 1')
              expect(video.podUrl).to.equal('localhost:9001')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(10)
              expect(video.tags).to.deep.equal([ 'tag1p1', 'tag2p1' ])
              expect(utils.dateIsValid(video.createdDate)).to.be.true
              expect(video.author).to.equal('root')

              if (server.url !== 'http://localhost:9001') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              utils.testImage(server.url, 'video_short1.webm', video.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                callback()
              })
            })
          }, done)
        }
      )
    })

    it('Should upload the video on pod 2 and propagate on each pod', function (done) {
      this.timeout(15000)

      async.series([
        function (next) {
          const name = 'my super name for pod 2'
          const description = 'my super description for pod 2'
          const tags = [ 'tag1p2', 'tag2p2', 'tag3p2' ]
          const file = 'video_short2.webm'
          utils.uploadVideo(servers[1].url, servers[1].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          async.each(servers, function (server, callback) {
            let baseMagnet = null

            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(2)
              const video = videos[1]
              expect(video.name).to.equal('my super name for pod 2')
              expect(video.description).to.equal('my super description for pod 2')
              expect(video.podUrl).to.equal('localhost:9002')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(5)
              expect(video.tags).to.deep.equal([ 'tag1p2', 'tag2p2', 'tag3p2' ])
              expect(utils.dateIsValid(video.createdDate)).to.be.true
              expect(video.author).to.equal('root')

              if (server.url !== 'http://localhost:9002') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              utils.testImage(server.url, 'video_short2.webm', video.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                callback()
              })
            })
          }, done)
        }
      )
    })

    it('Should upload two videos on pod 3 and propagate on each pod', function (done) {
      this.timeout(30000)

      async.series([
        function (next) {
          const name = 'my super name for pod 3'
          const description = 'my super description for pod 3'
          const tags = [ 'tag1p3' ]
          const file = 'video_short3.webm'
          utils.uploadVideo(servers[2].url, servers[2].accessToken, name, description, tags, file, next)
        },
        function (next) {
          const name = 'my super name for pod 3-2'
          const description = 'my super description for pod 3-2'
          const tags = [ 'tag2p3', 'tag3p3', 'tag4p3' ]
          const file = 'video_short.webm'
          utils.uploadVideo(servers[2].url, servers[2].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 22000)
        }],
        function (err) {
          if (err) throw err

          let baseMagnet = null
          // All pods should have this video
          async.each(servers, function (server, callback) {
            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(4)

              // We not sure about the order of the two last uploads
              let video1 = null
              let video2 = null
              if (videos[2].name === 'my super name for pod 3') {
                video1 = videos[2]
                video2 = videos[3]
              } else {
                video1 = videos[3]
                video2 = videos[2]
              }

              expect(video1.name).to.equal('my super name for pod 3')
              expect(video1.description).to.equal('my super description for pod 3')
              expect(video1.podUrl).to.equal('localhost:9003')
              expect(video1.magnetUri).to.exist
              expect(video1.duration).to.equal(5)
              expect(video1.tags).to.deep.equal([ 'tag1p3' ])
              expect(video1.author).to.equal('root')
              expect(utils.dateIsValid(video1.createdDate)).to.be.true

              expect(video2.name).to.equal('my super name for pod 3-2')
              expect(video2.description).to.equal('my super description for pod 3-2')
              expect(video2.podUrl).to.equal('localhost:9003')
              expect(video2.magnetUri).to.exist
              expect(video2.duration).to.equal(5)
              expect(video2.tags).to.deep.equal([ 'tag2p3', 'tag3p3', 'tag4p3' ])
              expect(video2.author).to.equal('root')
              expect(utils.dateIsValid(video2.createdDate)).to.be.true

              if (server.url !== 'http://localhost:9003') {
                expect(video1.isLocal).to.be.false
                expect(video2.isLocal).to.be.false
              } else {
                expect(video1.isLocal).to.be.true
                expect(video2.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video2.magnetUri
              } else {
                expect(video2.magnetUri).to.equal.magnetUri
              }

              utils.testImage(server.url, 'video_short3.webm', video1.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                utils.testImage(server.url, 'video_short.webm', video2.thumbnailPath, function (err, test) {
                  if (err) throw err
                  expect(test).to.equal(true)

                  callback()
                })
              })
            })
          }, done)
        }
      )
    })
  })

  describe('Should seed the uploaded video', function () {
    it('Should add the file 1 by asking pod 3', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      utils.getVideosList(servers[2].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[0]
        toRemove.push(res.body.data[2].id)
        toRemove.push(res.body.data[3].id)

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 2 by asking pod 1', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      utils.getVideosList(servers[0].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[1]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 3 by asking pod 2', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      utils.getVideosList(servers[1].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[2]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          webtorrent.remove(video.magnetUri, done)
        })
      })
    })

    it('Should add the file 3-2 by asking pod 1', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      utils.getVideosList(servers[0].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[3]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should remove the file 3 and 3-2 by asking pod 3', function (done) {
      this.timeout(15000)

      async.series([
        function (next) {
          utils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[0], next)
        },
        function (next) {
          utils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[1], next)
        }],
        function (err) {
          if (err) throw err
          setTimeout(done, 11000)
        }
      )
    })

    it('Should have videos 1 and 3 on each pod', function (done) {
      async.each(servers, function (server, callback) {
        utils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(2)
          expect(videos[0].id).not.to.equal(videos[1].id)
          expect(videos[0].id).not.to.equal(toRemove[0])
          expect(videos[1].id).not.to.equal(toRemove[0])
          expect(videos[0].id).not.to.equal(toRemove[1])
          expect(videos[1].id).not.to.equal(toRemove[1])

          callback()
        })
      }, done)
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })
    process.kill(-webtorrent.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      // utils.flushTests(done)
    } else {
      done()
    }
  })
})
