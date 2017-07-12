/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const each = require('async/each')
const eachSeries = require('async/eachSeries')
const expect = chai.expect
const parallel = require('async/parallel')
const series = require('async/series')
const WebTorrent = require('webtorrent')
const webtorrent = new WebTorrent()

const loginUtils = require('../utils/login')
const miscsUtils = require('../utils/miscs')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

describe('Test multiple pods', function () {
  let servers = []
  const toRemove = []
  let videoUUID = ''

  before(function (done) {
    this.timeout(120000)

    series([
      // Run servers
      function (next) {
        serversUtils.flushAndRunMultipleServers(3, function (serversRun) {
          servers = serversRun
          next()
        })
      },
      // Get the access tokens
      function (next) {
        each(servers, function (server, callbackEach) {
          loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
            if (err) return callbackEach(err)

            server.accessToken = accessToken
            callbackEach()
          })
        }, next)
      },
      // The second pod make friend with the third
      function (next) {
        const server = servers[1]
        podsUtils.makeFriends(server.url, server.accessToken, next)
      },
      // Wait for the request between pods
      function (next) {
        setTimeout(next, 10000)
      },
      // Pod 1 make friends too
      function (next) {
        const server = servers[0]
        podsUtils.makeFriends(server.url, server.accessToken, next)
      }
    ], done)
  })

  it('Should not have videos for all pods', function (done) {
    each(servers, function (server, callback) {
      videosUtils.getVideosList(server.url, function (err, res) {
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
      // Pod 1 has video transcoding activated
      this.timeout(15000)

      series([
        function (next) {
          const videoAttributes = {
            name: 'my super name for pod 1',
            category: 5,
            licence: 4,
            language: 9,
            nsfw: true,
            description: 'my super description for pod 1',
            tags: [ 'tag1p1', 'tag2p1' ],
            fixture: 'video_short1.webm'
          }
          videosUtils.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes, next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          each(servers, function (server, callback) {
            let baseMagnet = null

            videosUtils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(1)
              const video = videos[0]
              expect(video.name).to.equal('my super name for pod 1')
              expect(video.category).to.equal(5)
              expect(video.categoryLabel).to.equal('Sports')
              expect(video.licence).to.equal(4)
              expect(video.licenceLabel).to.equal('Attribution - Non Commercial')
              expect(video.language).to.equal(9)
              expect(video.languageLabel).to.equal('Japanese')
              expect(video.nsfw).to.be.truthy
              expect(video.description).to.equal('my super description for pod 1')
              expect(video.podHost).to.equal('localhost:9001')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(10)
              expect(video.tags).to.deep.equal([ 'tag1p1', 'tag2p1' ])
              expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true
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

              videosUtils.testVideoImage(server.url, 'video_short1.webm', video.thumbnailPath, function (err, test) {
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
      this.timeout(60000)

      series([
        function (next) {
          const videoAttributes = {
            name: 'my super name for pod 2',
            category: 4,
            licence: 3,
            language: 11,
            nsfw: true,
            description: 'my super description for pod 2',
            tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
            fixture: 'video_short2.webm'
          }
          videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes, next)
        },
        function (next) {
          // Transcoding, so wait more that 22 seconds
          setTimeout(next, 42000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          each(servers, function (server, callback) {
            let baseMagnet = null

            videosUtils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(2)
              const video = videos[1]
              expect(video.name).to.equal('my super name for pod 2')
              expect(video.category).to.equal(4)
              expect(video.categoryLabel).to.equal('Art')
              expect(video.licence).to.equal(3)
              expect(video.licenceLabel).to.equal('Attribution - No Derivatives')
              expect(video.language).to.equal(11)
              expect(video.languageLabel).to.equal('German')
              expect(video.nsfw).to.be.falsy
              expect(video.description).to.equal('my super description for pod 2')
              expect(video.podHost).to.equal('localhost:9002')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(5)
              expect(video.tags).to.deep.equal([ 'tag1p2', 'tag2p2', 'tag3p2' ])
              expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true
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

              videosUtils.testVideoImage(server.url, 'video_short2.webm', video.thumbnailPath, function (err, test) {
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
      this.timeout(45000)

      series([
        function (next) {
          const videoAttributes = {
            name: 'my super name for pod 3',
            category: 6,
            licence: 5,
            language: 11,
            nsfw: true,
            description: 'my super description for pod 3',
            tags: [ 'tag1p3' ],
            fixture: 'video_short3.webm'
          }
          videosUtils.uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes, next)
        },
        function (next) {
          const videoAttributes = {
            name: 'my super name for pod 3-2',
            category: 7,
            licence: 6,
            language: 12,
            nsfw: false,
            description: 'my super description for pod 3-2',
            tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
            fixture: 'video_short.webm'
          }
          videosUtils.uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes, next)
        },
        function (next) {
          setTimeout(next, 33000)
        }],
        function (err) {
          if (err) throw err

          let baseMagnet = null
          // All pods should have this video
          each(servers, function (server, callback) {
            videosUtils.getVideosList(server.url, function (err, res) {
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
              expect(video1.category).to.equal(6)
              expect(video1.categoryLabel).to.equal('Travels')
              expect(video1.licence).to.equal(5)
              expect(video1.licenceLabel).to.equal('Attribution - Non Commercial - Share Alike')
              expect(video1.language).to.equal(11)
              expect(video1.languageLabel).to.equal('German')
              expect(video1.nsfw).to.be.truthy
              expect(video1.description).to.equal('my super description for pod 3')
              expect(video1.podHost).to.equal('localhost:9003')
              expect(video1.magnetUri).to.exist
              expect(video1.duration).to.equal(5)
              expect(video1.tags).to.deep.equal([ 'tag1p3' ])
              expect(video1.author).to.equal('root')
              expect(miscsUtils.dateIsValid(video1.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video1.updatedAt)).to.be.true

              expect(video2.name).to.equal('my super name for pod 3-2')
              expect(video2.category).to.equal(7)
              expect(video2.categoryLabel).to.equal('Gaming')
              expect(video2.licence).to.equal(6)
              expect(video2.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
              expect(video2.language).to.equal(12)
              expect(video2.languageLabel).to.equal('Korean')
              expect(video2.nsfw).to.be.falsy
              expect(video2.description).to.equal('my super description for pod 3-2')
              expect(video2.podHost).to.equal('localhost:9003')
              expect(video2.magnetUri).to.exist
              expect(video2.duration).to.equal(5)
              expect(video2.tags).to.deep.equal([ 'tag2p3', 'tag3p3', 'tag4p3' ])
              expect(video2.author).to.equal('root')
              expect(miscsUtils.dateIsValid(video2.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video2.updatedAt)).to.be.true

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

              videosUtils.testVideoImage(server.url, 'video_short3.webm', video1.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                videosUtils.testVideoImage(server.url, 'video_short.webm', video2.thumbnailPath, function (err, test) {
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

      videosUtils.getVideosList(servers[2].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[0]
        toRemove.push(res.body.data[2])
        toRemove.push(res.body.data[3])

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

      videosUtils.getVideosList(servers[0].url, function (err, res) {
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

      videosUtils.getVideosList(servers[1].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[2]

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

      videosUtils.getVideosList(servers[0].url, function (err, res) {
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
  })

  describe('Should update video views, likes and dislikes', function () {
    let localVideosPod3 = []
    let remoteVideosPod1 = []
    let remoteVideosPod2 = []
    let remoteVideosPod3 = []

    before(function (done) {
      parallel([
        function (callback) {
          videosUtils.getVideosList(servers[0].url, function (err, res) {
            if (err) throw err

            remoteVideosPod1 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        },

        function (callback) {
          videosUtils.getVideosList(servers[1].url, function (err, res) {
            if (err) throw err

            remoteVideosPod2 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        },

        function (callback) {
          videosUtils.getVideosList(servers[2].url, function (err, res) {
            if (err) throw err

            localVideosPod3 = res.body.data.filter(video => video.isLocal === true).map(video => video.id)
            remoteVideosPod3 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        }
      ], done)
    })

    it('Should view multiple videos on owned servers', function (done) {
      this.timeout(30000)

      parallel([
        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          setTimeout(callback, 22000)
        }
      ], function (err) {
        if (err) throw err

        eachSeries(servers, function (server, callback) {
          videosUtils.getVideosList(server.url, function (err, res) {
            if (err) throw err

            const videos = res.body.data
            expect(videos.find(video => video.views === 3)).to.exist
            expect(videos.find(video => video.views === 1)).to.exist

            callback()
          })
        }, done)
      })
    })

    it('Should view multiple videos on each servers', function (done) {
      this.timeout(30000)

      parallel([
        function (callback) {
          videosUtils.getVideo(servers[0].url, remoteVideosPod1[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[1].url, remoteVideosPod2[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[1].url, remoteVideosPod2[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          setTimeout(callback, 22000)
        }
      ], function (err) {
        if (err) throw err

        let baseVideos = null
        eachSeries(servers, function (server, callback) {
          videosUtils.getVideosList(server.url, function (err, res) {
            if (err) throw err

            const videos = res.body.data

            // Initialize base videos for future comparisons
            if (baseVideos === null) {
              baseVideos = videos
              return callback()
            }

            baseVideos.forEach(baseVideo => {
              const sameVideo = videos.find(video => video.name === baseVideo.name)
              expect(baseVideo.views).to.equal(sameVideo.views)
            })

            callback()
          })
        }, done)
      })
    })

    it('Should like and dislikes videos on different services', function (done) {
      this.timeout(30000)

      parallel([
        function (callback) {
          videosUtils.rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'like', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'dislike', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'like', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[2].url, servers[2].accessToken, localVideosPod3[1], 'like', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[2].url, servers[2].accessToken, localVideosPod3[1], 'dislike', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[2].url, servers[2].accessToken, remoteVideosPod3[1], 'dislike', callback)
        },

        function (callback) {
          videosUtils.rateVideo(servers[2].url, servers[2].accessToken, remoteVideosPod3[0], 'like', callback)
        },

        function (callback) {
          setTimeout(callback, 22000)
        }
      ], function (err) {
        if (err) throw err

        let baseVideos = null
        eachSeries(servers, function (server, callback) {
          videosUtils.getVideosList(server.url, function (err, res) {
            if (err) throw err

            const videos = res.body.data

            // Initialize base videos for future comparisons
            if (baseVideos === null) {
              baseVideos = videos
              return callback()
            }

            baseVideos.forEach(baseVideo => {
              const sameVideo = videos.find(video => video.name === baseVideo.name)
              expect(baseVideo.likes).to.equal(sameVideo.likes)
              expect(baseVideo.dislikes).to.equal(sameVideo.dislikes)
            })

            callback()
          })
        }, done)
      })
    })
  })

  describe('Should manipulate these videos', function () {
    it('Should update the video 3 by asking pod 3', function (done) {
      this.timeout(15000)

      const attributes = {
        name: 'my super video updated',
        category: 10,
        licence: 7,
        language: 13,
        nsfw: true,
        description: 'my super description updated',
        tags: [ 'tagup1', 'tagup2' ]
      }
      videosUtils.updateVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, attributes, function (err) {
        if (err) throw err

        setTimeout(done, 11000)
      })
    })

    it('Should have the video 3 updated on each pod', function (done) {
      this.timeout(200000)

      each(servers, function (server, callback) {
        // Avoid "duplicate torrent" errors
        const webtorrent = new WebTorrent()

        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          const videoUpdated = videos.find(function (video) {
            return video.name === 'my super video updated'
          })

          expect(!!videoUpdated).to.be.true
          expect(videoUpdated.category).to.equal(10)
          expect(videoUpdated.categoryLabel).to.equal('Entertainment')
          expect(videoUpdated.licence).to.equal(7)
          expect(videoUpdated.licenceLabel).to.equal('Public Domain Dedication')
          expect(videoUpdated.language).to.equal(13)
          expect(videoUpdated.languageLabel).to.equal('French')
          expect(videoUpdated.nsfw).to.be.truthy
          expect(videoUpdated.description).to.equal('my super description updated')
          expect(videoUpdated.tags).to.deep.equal([ 'tagup1', 'tagup2' ])
          expect(miscsUtils.dateIsValid(videoUpdated.updatedAt, 20000)).to.be.true

          videosUtils.testVideoImage(server.url, 'video_short3.webm', videoUpdated.thumbnailPath, function (err, test) {
            if (err) throw err
            expect(test).to.equal(true)

            webtorrent.add(videoUpdated.magnetUri, function (torrent) {
              expect(torrent.files).to.exist
              expect(torrent.files.length).to.equal(1)
              expect(torrent.files[0].path).to.exist.and.to.not.equal('')

              callback()
            })
          })
        })
      }, done)
    })

    it('Should remove the videos 3 and 3-2 by asking pod 3', function (done) {
      this.timeout(15000)

      series([
        function (next) {
          videosUtils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, next)
        },
        function (next) {
          videosUtils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[1].id, next)
        }],
        function (err) {
          if (err) throw err
          setTimeout(done, 11000)
        }
      )
    })

    it('Should have videos 1 and 3 on each pod', function (done) {
      each(servers, function (server, callback) {
        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(2)
          expect(videos[0].name).not.to.equal(videos[1].name)
          expect(videos[0].name).not.to.equal(toRemove[0].name)
          expect(videos[1].name).not.to.equal(toRemove[0].name)
          expect(videos[0].name).not.to.equal(toRemove[1].name)
          expect(videos[1].name).not.to.equal(toRemove[1].name)

          videoUUID = videos.find(video => video.name === 'my super name for pod 1').uuid

          callback()
        })
      }, done)
    })

    it('Should get the same video by UUID on each pod', function (done) {
      let baseVideo = null
      each(servers, function (server, callback) {
        videosUtils.getVideo(server.url, videoUUID, function (err, res) {
          if (err) throw err

          const video = res.body

          if (baseVideo === null) {
            baseVideo = video
            return callback()
          }

          expect(baseVideo.name).to.equal(video.name)
          expect(baseVideo.uuid).to.equal(video.uuid)
          expect(baseVideo.category).to.equal(video.category)
          expect(baseVideo.language).to.equal(video.language)
          expect(baseVideo.licence).to.equal(video.licence)
          expect(baseVideo.category).to.equal(video.category)
          expect(baseVideo.nsfw).to.equal(video.nsfw)
          expect(baseVideo.author).to.equal(video.author)
          expect(baseVideo.tags).to.deep.equal(video.tags)

          callback()
        })
      }, done)
    })

    it('Should get the preview from each pod', function (done) {
      each(servers, function (server, callback) {
        videosUtils.getVideo(server.url, videoUUID, function (err, res) {
          if (err) throw err

          const video = res.body

          videosUtils.testVideoImage(server.url, 'video_short1-preview.webm', video.previewPath, function (err, test) {
            if (err) throw err
            expect(test).to.equal(true)

            callback()
          })
        })
      }, done)
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
