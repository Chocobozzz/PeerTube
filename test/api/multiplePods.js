;(function () {
  'use strict'

  var request = require('supertest')
  var chai = require('chai')
  var expect = chai.expect
  var async = require('async')

  var utils = require('../utils')
  var webtorrent = require(__dirname + '/../../src/webTorrentNode')
  webtorrent.silent = true

  describe('Test multiple pods', function () {
    var path = '/api/v1/videos'
    var apps = []
    var urls = []
    var video_id = -1

    function getVideosList (url, end) {
      request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(end)
    }

    function uploadVideo (url, name, description, fixture, end) {
      request(url)
        .post(path)
        .set('Accept', 'application/json')
        .field('name', name)
        .field('description', description)
        .attach('input_video', __dirname + '/../fixtures/' + fixture)
        .expect(201)
        .end(end)
    }

    before(function (done) {
      this.timeout(30000)
      var path_friends = '/api/v1/pods/makefriends'

      utils.runMultipleServers(3, function (apps_run, urls_run) {
        apps = apps_run
        urls = urls_run

        // The second pod make friend with the third
        request(urls[1])
          .get(path_friends)
          .set('Accept', 'application/json')
          .expect(204)
          .end(function (err, res) {
            if (err) throw err

            // Wait for the request between pods
            setTimeout(function () {
              request(urls[0])
                .get(path_friends)
                .set('Accept', 'application/json')
                .expect(204)
                .end(function (err, res) {
                  if (err) throw err

                  webtorrent.create({ host: 'client', port: '1' }, function () {
                    done()
                  })
                })
            }, 10000)
          })
      })
    })

    it('Should not have videos for all pods', function (done) {
      async.each(urls, function (url, callback) {
        getVideosList(url, function (err, res) {
          if (err) throw err

          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(0)

          callback()
        })
      }, function (err) {
        if (err) throw err

        done()
      })
    })

    describe('Should upload the video and propagate on each pod', function () {
      it('Should upload the video on pod 1 and propagate on each pod', function (done) {
        this.timeout(5000)

        uploadVideo(urls[0], 'my super name for pod 1', 'my super description for pod 1', 'video_short1.webm', function (err) {
          if (err) throw err

          setTimeout(function () {
            // All pods should have this video
            async.each(urls, function (url, callback) {
              var base_magnet = null

              getVideosList(url, function (err, res) {
                if (err) throw err

                var videos = res.body
                expect(videos).to.be.an('array')
                expect(videos.length).to.equal(1)
                var video = videos[0]
                expect(video.name).to.equal('my super name for pod 1')
                expect(video.description).to.equal('my super description for pod 1')
                expect(video.podUrl).to.equal('http://localhost:9001')
                expect(video.magnetUri).to.exist

                // All pods should have the same magnet Uri
                if (base_magnet === null) {
                  base_magnet = video.magnetUri
                } else {
                  expect(video.magnetUri).to.equal.magnetUri
                }

                callback()
              })
            }, function (err) {
              if (err) throw err

              done()
            })
          }, 1000)
        })
      })

      it('Should upload the video on pod 2 and propagate on each pod', function (done) {
        this.timeout(5000)

        uploadVideo(urls[1], 'my super name for pod 2', 'my super description for pod 2', 'video_short2.webm', function (err) {
          if (err) throw err

          setTimeout(function () {
            // All pods should have this video
            async.each(urls, function (url, callback) {
              var base_magnet = null

              getVideosList(url, function (err, res) {
                if (err) throw err

                var videos = res.body
                expect(videos).to.be.an('array')
                expect(videos.length).to.equal(2)
                var video = videos[1]
                expect(video.name).to.equal('my super name for pod 2')
                expect(video.description).to.equal('my super description for pod 2')
                expect(video.podUrl).to.equal('http://localhost:9002')
                expect(video.magnetUri).to.exist

                // All pods should have the same magnet Uri
                if (base_magnet === null) {
                  base_magnet = video.magnetUri
                } else {
                  expect(video.magnetUri).to.equal.magnetUri
                }

                callback()
              })
            }, function (err) {
              if (err) throw err

              done()
            })
          }, 1000)
        })
      })

      it('Should upload the video on pod 3 and propagate on each pod', function (done) {
        this.timeout(5000)

        uploadVideo(urls[2], 'my super name for pod 3', 'my super description for pod 3', 'video_short3.webm', function (err) {
          if (err) throw err

          setTimeout(function () {
            var base_magnet = null
            // All pods should have this video
            async.each(urls, function (url, callback) {
              getVideosList(url, function (err, res) {
                if (err) throw err

                var videos = res.body
                expect(videos).to.be.an('array')
                expect(videos.length).to.equal(3)
                var video = videos[2]
                expect(video.name).to.equal('my super name for pod 3')
                expect(video.description).to.equal('my super description for pod 3')
                expect(video.podUrl).to.equal('http://localhost:9003')
                expect(video.magnetUri).to.exist

                // All pods should have the same magnet Uri
                if (base_magnet === null) {
                  base_magnet = video.magnetUri
                } else {
                  expect(video.magnetUri).to.equal.magnetUri
                }

                callback()
              })
            }, function (err) {
              if (err) throw err

              done()
            })
          }, 1000)
        })
      })
    })

    describe('Should seed the uploaded video', function () {
      it('Should add the file 1 by asking pod 3', function (done) {
        // Yes, this could be long
        this.timeout(200000)

        getVideosList(urls[2], function (err, res) {
          if (err) throw err

          var video = res.body[0]
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

        getVideosList(urls[0], function (err, res) {
          if (err) throw err

          var video = res.body[1]

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

        getVideosList(urls[1], function (err, res) {
          if (err) throw err

          var video = res.body[2]
          video_id = res.body[1]._id

          webtorrent.add(video.magnetUri, function (torrent) {
            expect(torrent.files).to.exist
            expect(torrent.files.length).to.equal(1)
            expect(torrent.files[0].path).to.exist.and.to.not.equal('')

            done()
          })
        })
      })

      it('Should remove the file 2 by asking pod 2', function (done) {
        request(urls[1])
          .delete(path + '/' + video_id)
          .set('Accept', 'application/json')
          .expect(204)
          .end(function (err, res) {
            if (err) throw err

            // Wait the propagation to the other pods
            setTimeout(function () {
              done()
            }, 1000)
          })
      })

      it('Should have videos 1 and 3 on each pod', function (done) {
        async.each(urls, function (url, callback) {
          getVideosList(url, function (err, res) {
            if (err) throw err

            var videos = res.body
            expect(videos).to.be.an('array')
            expect(videos.length).to.equal(2)
            expect(videos[0]._id).not.to.equal(videos[1]._id)
            expect(videos[0]._id).not.to.equal(video_id)
            expect(videos[1]._id).not.to.equal(video_id)

            callback()
          })
        }, function (err) {
          if (err) throw err

          done()
        })
      })
    })

    after(function (done) {
      apps.forEach(function (app) {
        process.kill(-app.pid)
      })
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
