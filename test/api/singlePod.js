;(function () {
  'use strict'

  var request = require('supertest')
  var chai = require('chai')
  var fs = require('fs')
  var expect = chai.expect
  var webtorrent = require(__dirname + '/../../src/webTorrentNode')
  webtorrent.silent = true

  var utils = require('../utils')

  describe('Test a single pod', function () {
    var path = '/api/v1/videos'
    var app = null
    var url = ''
    var video_id = -1

    before(function (done) {
      this.timeout(20000)

      utils.flushTests(function () {
        utils.runServer(1, function (app1, url1) {
          app = app1
          url = url1

          webtorrent.create({ host: 'client', port: '1' }, function () {
            done()
          })
        })
      })
    })

    it('Should not have videos', function (done) {
      request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err

          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(0)

          done()
        })
    })

    it('Should upload the video', function (done) {
      this.timeout(5000)

      request(url)
        .post(path)
        .set('Accept', 'application/json')
        .field('name', 'my super name')
        .field('description', 'my super description')
        .attach('input_video', __dirname + '/../fixtures/video_short.webm')
        .expect(201, done)
    })

    it('Should seed the uploaded video', function (done) {
      // Yes, this could be long
      this.timeout(60000)

      request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
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
      request(url)
        .get(path + '/search/my')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
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
      request(url)
        .get(path + '/search/hello')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err

          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(0)

          done()
        })
    })

    it('Should remove the video', function (done) {
      request(url)
        .delete(path + '/' + video_id)
        .set('Accept', 'application/json')
        .expect(204)
        .end(function (err, res) {
          if (err) throw err

          fs.readdir(__dirname + '/../../test1/uploads/', function (err, files) {
            if (err) throw err

            expect(files.length).to.equal(0)
            done()
          })
        })
    })

    it('Should not have videos', function (done) {
      request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
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
        utils.flushTests(function () {
          done()
        })
      } else {
        done()
      }
    })
  })
})()
