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
  const to_remove = []

  before(function (done) {
    this.timeout(30000)

    async.series([
      // Run servers
      function (next) {
        utils.flushAndRunMultipleServers(3, function (servers_run) {
          servers = servers_run
          next()
        })
      },
      // Get the access tokens
      function (next) {
        async.each(servers, function (server, callback_each) {
          utils.loginAndGetAccessToken(server, function (err, access_token) {
            if (err) return callback_each(err)

            server.access_token = access_token
            callback_each()
          })
        }, next)
      },
      // The second pod make friend with the third
      function (next) {
        utils.makeFriends(servers[1].url, next)
      },
      // Wait for the request between pods
      function (next) {
        setTimeout(next, 10000)
      },
      // Pod 1 make friends too
      function (next) {
        utils.makeFriends(servers[0].url, next)
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

        expect(res.body).to.be.an('array')
        expect(res.body.length).to.equal(0)

        callback()
      })
    }, done)
  })

  describe('Should upload the video and propagate on each pod', function () {
    it('Should upload the video on pod 1 and propagate on each pod', function (done) {
      this.timeout(15000)

      async.series([
        function (next) {
          utils.uploadVideo(servers[0].url, servers[0].access_token, 'my super name for pod 1', 'my super description for pod 1', 'video_short1.webm', next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          async.each(servers, function (server, callback) {
            let base_magnet = null

            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(1)
              const video = videos[0]
              expect(video.name).to.equal('my super name for pod 1')
              expect(video.description).to.equal('my super description for pod 1')
              expect(video.podUrl).to.equal('http://localhost:9001')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(10)

              if (server.url !== 'http://localhost:9001') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (base_magnet === null) {
                base_magnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              callback()
            })
          }, done)
        }
      )
    })

    it('Should upload the video on pod 2 and propagate on each pod', function (done) {
      this.timeout(15000)

      async.series([
        function (next) {
          utils.uploadVideo(servers[1].url, servers[1].access_token, 'my super name for pod 2', 'my super description for pod 2', 'video_short2.webm', next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          async.each(servers, function (server, callback) {
            let base_magnet = null

            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(2)
              const video = videos[1]
              expect(video.name).to.equal('my super name for pod 2')
              expect(video.description).to.equal('my super description for pod 2')
              expect(video.podUrl).to.equal('http://localhost:9002')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(5)

              if (server.url !== 'http://localhost:9002') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (base_magnet === null) {
                base_magnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              callback()
            })
          }, done)
        }
      )
    })

    it('Should upload two videos on pod 3 and propagate on each pod', function (done) {
      this.timeout(30000)

      async.series([
        function (next) {
          utils.uploadVideo(servers[2].url, servers[2].access_token, 'my super name for pod 3', 'my super description for pod 3', 'video_short3.webm', next)
        },
        function (next) {
          utils.uploadVideo(servers[2].url, servers[2].access_token, 'my super name for pod 3-2', 'my super description for pod 3-2', 'video_short.webm', next)
        },
        function (next) {
          setTimeout(next, 22000)
        }],
        function (err) {
          if (err) throw err

          let base_magnet = null
          // All pods should have this video
          async.each(servers, function (server, callback) {
            utils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body
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
              expect(video1.podUrl).to.equal('http://localhost:9003')
              expect(video1.magnetUri).to.exist
              expect(video1.duration).to.equal(5)

              expect(video2.name).to.equal('my super name for pod 3-2')
              expect(video2.description).to.equal('my super description for pod 3-2')
              expect(video2.podUrl).to.equal('http://localhost:9003')
              expect(video2.magnetUri).to.exist
              expect(video2.duration).to.equal(5)

              if (server.url !== 'http://localhost:9003') {
                expect(video1.isLocal).to.be.false
                expect(video2.isLocal).to.be.false
              } else {
                expect(video1.isLocal).to.be.true
                expect(video2.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (base_magnet === null) {
                base_magnet = video2.magnetUri
              } else {
                expect(video2.magnetUri).to.equal.magnetUri
              }

              callback()
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

        const video = res.body[0]
        to_remove.push(res.body[2].id)
        to_remove.push(res.body[3].id)

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

        const video = res.body[1]

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

        const video = res.body[2]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 3-2 by asking pod 1', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      utils.getVideosList(servers[0].url, function (err, res) {
        if (err) throw err

        const video = res.body[3]

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
          utils.removeVideo(servers[2].url, servers[2].access_token, to_remove[0], next)
        },
        function (next) {
          utils.removeVideo(servers[2].url, servers[2].access_token, to_remove[1], next)
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

          const videos = res.body
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(2)
          expect(videos[0].id).not.to.equal(videos[1].id)
          expect(videos[0].id).not.to.equal(to_remove[0])
          expect(videos[1].id).not.to.equal(to_remove[0])
          expect(videos[0].id).not.to.equal(to_remove[1])
          expect(videos[1].id).not.to.equal(to_remove[1])

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
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
