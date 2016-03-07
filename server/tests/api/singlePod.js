'use strict'

var async = require('async')
var chai = require('chai')
var expect = chai.expect
var fs = require('fs')
var pathUtils = require('path')

var webtorrent = require(pathUtils.join(__dirname, '../../lib/webtorrent'))
webtorrent.silent = true

var utils = require('./utils')

describe('Test a single pod', function () {
  var app = null
  var url = ''
  var video_id = -1

  before(function (done) {
    this.timeout(20000)

    async.series([
      function (next) {
        utils.flushTests(next)
      },
      function (next) {
        utils.runServer(1, function (app1, url1) {
          app = app1
          url = url1
          next()
        })
      },
      function (next) {
        webtorrent.create({ host: 'client', port: '1' }, next)
      }
    ], done)
  })

  it('Should not have videos', function (done) {
    utils.getVideosList(url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  it('Should upload the video', function (done) {
    this.timeout(5000)
    utils.uploadVideo(url, 'my super name', 'my super description', 'video_short.webm', done)
  })

  it('Should seed the uploaded video', function (done) {
    // Yes, this could be long
    this.timeout(60000)

    utils.getVideosList(url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(1)

      var video = res.body[0]
      expect(video.name).to.equal('my super name')
      expect(video.description).to.equal('my super description')
      expect(video.podUrl).to.equal('http://localhost:9001')
      expect(video.magnetUri).to.exist

      video_id = video._id

      webtorrent.add(video.magnetUri, function (torrent) {
        expect(torrent.files).to.exist
        expect(torrent.files.length).to.equal(1)
        expect(torrent.files[0].path).to.exist.and.to.not.equal('')

        done()
      })
    })
  })

  it('Should search the video', function (done) {
    utils.searchVideo(url, 'my', function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(1)

      var video = res.body[0]
      expect(video.name).to.equal('my super name')
      expect(video.description).to.equal('my super description')
      expect(video.podUrl).to.equal('http://localhost:9001')
      expect(video.magnetUri).to.exist

      done()
    })
  })

  it('Should not find a search', function (done) {
    utils.searchVideo(url, 'hello', function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  it('Should remove the video', function (done) {
    utils.removeVideo(url, video_id, function (err) {
      if (err) throw err

      fs.readdir(pathUtils.join(__dirname, '../../test1/uploads/'), function (err, files) {
        if (err) throw err

        expect(files.length).to.equal(0)
        done()
      })
    })
  })

  it('Should not have videos', function (done) {
    utils.getVideosList(url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  after(function (done) {
    process.kill(-app.pid)
    process.kill(-webtorrent.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
