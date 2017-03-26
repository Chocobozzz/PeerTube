/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const each = require('async/each')
const expect = chai.expect
const fs = require('fs')
const keyBy = require('lodash/keyBy')
const pathUtils = require('path')
const series = require('async/series')
const webtorrent = new (require('webtorrent'))()

const loginUtils = require('../utils/login')
const miscsUtils = require('../utils/miscs')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

describe('Test a single pod', function () {
  let server = null
  let videoId = -1
  let videosListBase = null

  before(function (done) {
    this.timeout(20000)

    series([
      function (next) {
        serversUtils.flushTests(next)
      },
      function (next) {
        serversUtils.runServer(1, function (server1) {
          server = server1
          next()
        })
      },
      function (next) {
        loginUtils.loginAndGetAccessToken(server, function (err, token) {
          if (err) throw err
          server.accessToken = token
          next()
        })
      }
    ], done)
  })

  it('Should list video categories', function (done) {
    videosUtils.getVideoCategories(server.url, function (err, res) {
      if (err) throw err

      const categories = res.body
      expect(Object.keys(categories)).to.have.length.above(10)

      expect(categories[11]).to.equal('News')

      done()
    })
  })

  it('Should not have videos', function (done) {
    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should upload the video', function (done) {
    const videoAttributes = {
      name: 'my super name',
      category: 2,
      tags: [ 'tag1', 'tag2', 'tag3' ]
    }
    videosUtils.uploadVideo(server.url, server.accessToken, videoAttributes, done)
  })

  it('Should seed the uploaded video', function (done) {
    // Yes, this could be long
    this.timeout(60000)

    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      const video = res.body.data[0]
      expect(video.name).to.equal('my super name')
      expect(video.category).to.equal(2)
      expect(video.categoryLabel).to.equal('Films')
      expect(video.description).to.equal('my super description')
      expect(video.podHost).to.equal('localhost:9001')
      expect(video.magnetUri).to.exist
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true
      expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
      expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
      expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

      videosUtils.testVideoImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        videoId = video.id

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })
  })

  it('Should get the video', function (done) {
    // Yes, this could be long
    this.timeout(60000)

    videosUtils.getVideo(server.url, videoId, function (err, res) {
      if (err) throw err

      const video = res.body
      expect(video.name).to.equal('my super name')
      expect(video.category).to.equal(2)
      expect(video.categoryLabel).to.equal('Films')
      expect(video.description).to.equal('my super description')
      expect(video.podHost).to.equal('localhost:9001')
      expect(video.magnetUri).to.exist
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true
      expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
      expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
      expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

      videosUtils.testVideoImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        done()
      })
    })
  })

  it('Should have the views updated', function (done) {
    videosUtils.getVideo(server.url, videoId, function (err, res) {
      if (err) throw err

      const video = res.body
      expect(video.views).to.equal(1)

      done()
    })
  })

  it('Should search the video by name by default', function (done) {
    videosUtils.searchVideo(server.url, 'my', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      const video = res.body.data[0]
      expect(video.name).to.equal('my super name')
      expect(video.category).to.equal(2)
      expect(video.categoryLabel).to.equal('Films')
      expect(video.description).to.equal('my super description')
      expect(video.podHost).to.equal('localhost:9001')
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true
      expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
      expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
      expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

      videosUtils.testVideoImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        done()
      })
    })
  })

  // Not implemented yet
  // it('Should search the video by podHost', function (done) {
  //   videosUtils.searchVideo(server.url, '9001', 'host', function (err, res) {
  //     if (err) throw err

  //     expect(res.body.total).to.equal(1)
  //     expect(res.body.data).to.be.an('array')
  //     expect(res.body.data.length).to.equal(1)

  //     const video = res.body.data[0]
  //     expect(video.name).to.equal('my super name')
  //     expect(video.description).to.equal('my super description')
  //     expect(video.podHost).to.equal('localhost:9001')
  //     expect(video.author).to.equal('root')
  //     expect(video.isLocal).to.be.true
  //     expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
  //     expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
  //     expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

  //     videosUtils.testVideoImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
  //       if (err) throw err
  //       expect(test).to.equal(true)

  //       done()
  //     })
  //   })
  // })

  it('Should search the video by tag', function (done) {
    videosUtils.searchVideo(server.url, 'tag1', 'tags', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      const video = res.body.data[0]
      expect(video.name).to.equal('my super name')
      expect(video.category).to.equal(2)
      expect(video.categoryLabel).to.equal('Films')
      expect(video.description).to.equal('my super description')
      expect(video.podHost).to.equal('localhost:9001')
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true
      expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
      expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
      expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

      videosUtils.testVideoImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        done()
      })
    })
  })

  it('Should not find a search by name by default', function (done) {
    videosUtils.searchVideo(server.url, 'hello', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should not find a search by author', function (done) {
    videosUtils.searchVideo(server.url, 'hello', 'author', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should not find a search by tag', function (done) {
    videosUtils.searchVideo(server.url, 'hello', 'tags', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should remove the video', function (done) {
    videosUtils.removeVideo(server.url, server.accessToken, videoId, function (err) {
      if (err) throw err

      fs.readdir(pathUtils.join(__dirname, '..', '..', '..', 'test1/videos/'), function (err, files) {
        if (err) throw err

        expect(files.length).to.equal(0)

        fs.readdir(pathUtils.join(__dirname, '..', '..', '..', 'test1/thumbnails/'), function (err, files) {
          if (err) throw err

          expect(files.length).to.equal(0)

          done()
        })
      })
    })
  })

  it('Should not have videos', function (done) {
    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should upload 6 videos', function (done) {
    this.timeout(25000)
    const videos = [
      'video_short.mp4', 'video_short.ogv', 'video_short.webm',
      'video_short1.webm', 'video_short2.webm', 'video_short3.webm'
    ]
    each(videos, function (video, callbackEach) {
      const videoAttributes = {
        name: video + ' name',
        description: video + ' description',
        category: 2,
        tags: [ 'tag1', 'tag2', 'tag3' ],
        fixture: video
      }

      videosUtils.uploadVideo(server.url, server.accessToken, videoAttributes, callbackEach)
    }, done)
  })

  it('Should have the correct durations', function (done) {
    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(6)
      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(6)

      const videosByName = keyBy(videos, 'name')
      expect(videosByName['video_short.mp4 name'].duration).to.equal(5)
      expect(videosByName['video_short.ogv name'].duration).to.equal(5)
      expect(videosByName['video_short.webm name'].duration).to.equal(5)
      expect(videosByName['video_short1.webm name'].duration).to.equal(10)
      expect(videosByName['video_short2.webm name'].duration).to.equal(5)
      expect(videosByName['video_short3.webm name'].duration).to.equal(5)

      done()
    })
  })

  it('Should have the correct thumbnails', function (done) {
    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      const videos = res.body.data
      // For the next test
      videosListBase = videos

      each(videos, function (video, callbackEach) {
        if (err) throw err
        const videoName = video.name.replace(' name', '')

        videosUtils.testVideoImage(server.url, videoName, video.thumbnailPath, function (err, test) {
          if (err) throw err

          expect(test).to.equal(true)
          callbackEach()
        })
      }, done)
    })
  })

  it('Should list only the two first videos', function (done) {
    videosUtils.getVideosListPagination(server.url, 0, 2, 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(6)
      expect(videos.length).to.equal(2)
      expect(videos[0].name).to.equal(videosListBase[0].name)
      expect(videos[1].name).to.equal(videosListBase[1].name)

      done()
    })
  })

  it('Should list only the next three videos', function (done) {
    videosUtils.getVideosListPagination(server.url, 2, 3, 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(6)
      expect(videos.length).to.equal(3)
      expect(videos[0].name).to.equal(videosListBase[2].name)
      expect(videos[1].name).to.equal(videosListBase[3].name)
      expect(videos[2].name).to.equal(videosListBase[4].name)

      done()
    })
  })

  it('Should list the last video', function (done) {
    videosUtils.getVideosListPagination(server.url, 5, 6, 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(6)
      expect(videos.length).to.equal(1)
      expect(videos[0].name).to.equal(videosListBase[5].name)

      done()
    })
  })

  it('Should search the first video', function (done) {
    videosUtils.searchVideoWithPagination(server.url, 'webm', 'name', 0, 1, 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(4)
      expect(videos.length).to.equal(1)
      expect(videos[0].name).to.equal('video_short1.webm name')

      done()
    })
  })

  it('Should search the last two videos', function (done) {
    videosUtils.searchVideoWithPagination(server.url, 'webm', 'name', 2, 2, 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(4)
      expect(videos.length).to.equal(2)
      expect(videos[0].name).to.equal('video_short3.webm name')
      expect(videos[1].name).to.equal('video_short.webm name')

      done()
    })
  })

  it('Should search all the webm videos', function (done) {
    videosUtils.searchVideoWithPagination(server.url, 'webm', 'name', 0, 15, function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(4)
      expect(videos.length).to.equal(4)

      done()
    })
  })

  it('Should search all the root author videos', function (done) {
    videosUtils.searchVideoWithPagination(server.url, 'root', 'author', 0, 15, function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(6)
      expect(videos.length).to.equal(6)

      done()
    })
  })

  // Not implemented yet
  // it('Should search all the 9001 port videos', function (done) {
  //   videosUtils.searchVideoWithPagination(server.url, '9001', 'host', 0, 15, function (err, res) {
  //     if (err) throw err

  //     const videos = res.body.data
  //     expect(res.body.total).to.equal(6)
  //     expect(videos.length).to.equal(6)

  //     done()
  //   })
  // })

  // it('Should search all the localhost videos', function (done) {
  //   videosUtils.searchVideoWithPagination(server.url, 'localhost', 'host', 0, 15, function (err, res) {
  //     if (err) throw err

  //     const videos = res.body.data
  //     expect(res.body.total).to.equal(6)
  //     expect(videos.length).to.equal(6)

  //     done()
  //   })
  // })

  it('Should search the right magnetUri video', function (done) {
    const video = videosListBase[0]
    videosUtils.searchVideoWithPagination(server.url, encodeURIComponent(video.magnetUri), 'magnetUri', 0, 15, function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(1)
      expect(videos.length).to.equal(1)
      expect(videos[0].name).to.equal(video.name)

      done()
    })
  })

  it('Should list and sort by name in descending order', function (done) {
    videosUtils.getVideosListSort(server.url, '-name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(6)
      expect(videos.length).to.equal(6)
      expect(videos[0].name).to.equal('video_short.webm name')
      expect(videos[1].name).to.equal('video_short.ogv name')
      expect(videos[2].name).to.equal('video_short.mp4 name')
      expect(videos[3].name).to.equal('video_short3.webm name')
      expect(videos[4].name).to.equal('video_short2.webm name')
      expect(videos[5].name).to.equal('video_short1.webm name')

      done()
    })
  })

  it('Should search and sort by name in ascending order', function (done) {
    videosUtils.searchVideoWithSort(server.url, 'webm', 'name', function (err, res) {
      if (err) throw err

      const videos = res.body.data
      expect(res.body.total).to.equal(4)
      expect(videos.length).to.equal(4)

      expect(videos[0].name).to.equal('video_short1.webm name')
      expect(videos[1].name).to.equal('video_short2.webm name')
      expect(videos[2].name).to.equal('video_short3.webm name')
      expect(videos[3].name).to.equal('video_short.webm name')

      videoId = videos[2].id

      done()
    })
  })

  it('Should update a video', function (done) {
    const attributes = {
      name: 'my super video updated',
      category: 4,
      description: 'my super description updated',
      tags: [ 'tagup1', 'tagup2' ]
    }
    videosUtils.updateVideo(server.url, server.accessToken, videoId, attributes, done)
  })

  it('Should have the video updated', function (done) {
    this.timeout(60000)

    videosUtils.getVideo(server.url, videoId, function (err, res) {
      if (err) throw err

      const video = res.body

      expect(video.name).to.equal('my super video updated')
      expect(video.category).to.equal(4)
      expect(video.categoryLabel).to.equal('Art')
      expect(video.description).to.equal('my super description updated')
      expect(video.podHost).to.equal('localhost:9001')
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true
      expect(video.tags).to.deep.equal([ 'tagup1', 'tagup2' ])
      expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
      expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

      videosUtils.testVideoImage(server.url, 'video_short3.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })
  })

  it('Should update only the tags of a video', function (done) {
    const attributes = {
      tags: [ 'tag1', 'tag2', 'supertag' ]
    }

    videosUtils.updateVideo(server.url, server.accessToken, videoId, attributes, function (err) {
      if (err) throw err

      videosUtils.getVideo(server.url, videoId, function (err, res) {
        if (err) throw err

        const video = res.body

        expect(video.name).to.equal('my super video updated')
        expect(video.category).to.equal(4)
        expect(video.categoryLabel).to.equal('Art')
        expect(video.description).to.equal('my super description updated')
        expect(video.podHost).to.equal('localhost:9001')
        expect(video.author).to.equal('root')
        expect(video.isLocal).to.be.true
        expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'supertag' ])
        expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
        expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

        done()
      })
    })
  })

  it('Should update only the description of a video', function (done) {
    const attributes = {
      description: 'hello everybody'
    }

    videosUtils.updateVideo(server.url, server.accessToken, videoId, attributes, function (err) {
      if (err) throw err

      videosUtils.getVideo(server.url, videoId, function (err, res) {
        if (err) throw err

        const video = res.body

        expect(video.name).to.equal('my super video updated')
        expect(video.category).to.equal(4)
        expect(video.categoryLabel).to.equal('Art')
        expect(video.description).to.equal('hello everybody')
        expect(video.podHost).to.equal('localhost:9001')
        expect(video.author).to.equal('root')
        expect(video.isLocal).to.be.true
        expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'supertag' ])
        expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
        expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true

        done()
      })
    })
  })

  it('Should like a video', function (done) {
    videosUtils.rateVideo(server.url, server.accessToken, videoId, 'like', function (err) {
      if (err) throw err

      videosUtils.getVideo(server.url, videoId, function (err, res) {
        if (err) throw err

        const video = res.body

        expect(video.likes).to.equal(1)
        expect(video.dislikes).to.equal(0)

        done()
      })
    })
  })

  it('Should dislike the same video', function (done) {
    videosUtils.rateVideo(server.url, server.accessToken, videoId, 'dislike', function (err) {
      if (err) throw err

      videosUtils.getVideo(server.url, videoId, function (err, res) {
        if (err) throw err

        const video = res.body

        expect(video.likes).to.equal(0)
        expect(video.dislikes).to.equal(1)

        done()
      })
    })
  })

  after(function (done) {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
