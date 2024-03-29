/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests, createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'

describe('Test automatic tags', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    await servers[1].config.enableLive({ allowReplay: false })

    await doubleFollow(servers[0], servers[1]);

    ({ uuid: videoUUID } = await servers[0].videos.quickUpload({ name: 'video' }))

    await waitJobs(servers)
  })

  describe('Automatic tags on comments', function () {

    describe('Built in external link auto tag', function () {

      it('Should not assign external-link automatic tag with no URL inside the comment', async function () {
        const tests = [
          'my super comment',
          'toto.azfazfe',
          'Hello. Hi friends'
        ]

        for (const toTest of tests) {
          await servers[0].comments.createThread({ videoId: videoUUID, text: toTest })
          await waitJobs(servers)
        }

        for (const server of servers) {
          const { data } = await server.comments.listForAdmin()

          for (const comment of data) {
            expect(comment.automaticTags, `"${comment.text}" has an automatic tag`).to.have.lengthOf(0)
          }
        }

        await servers[0].comments.deleteAllComments({ videoUUID })
        await waitJobs(servers)
      })

      it('Should not assign external-link automatic tag if the URL is an internal link', async function () {
        const tests = [
          `Hi ${servers[0].url}`
        ]

        for (const toTest of tests) {
          await servers[0].comments.createThread({ videoId: videoUUID, text: toTest })
          await waitJobs(servers)
        }

        // Server 1
        {
          const { data } = await servers[0].comments.listForAdmin()

          for (const comment of data) {
            expect(comment.automaticTags, `"${comment.text}" has an automatic tag`).to.have.lengthOf(0)
          }
        }

        // Server 2
        {
          const { data } = await servers[1].comments.listForAdmin()

          for (const comment of data) {
            expect(comment.automaticTags, `"${comment.text}" hasn't an automatic tag`).to.have.lengthOf(1)
            expect(comment.automaticTags[0]).to.equal('external-link')
          }
        }

        await servers[0].comments.deleteAllComments({ videoUUID })
        await waitJobs(servers)
      })

      it('Should assign external-link automatic tag', async function () {
        const tests = [
          'example.com',
          'Hi example.com'
        ]

        for (const toTest of tests) {
          await servers[0].comments.createThread({ videoId: videoUUID, text: toTest })
          await waitJobs(servers)
        }

        for (const server of servers) {
          const { data } = await server.comments.listForAdmin()

          for (const comment of data) {
            expect(comment.automaticTags).to.have.lengthOf(1)
            expect(comment.automaticTags[0]).to.equal('external-link')
          }
        }

        await servers[0].comments.deleteAllComments({ videoUUID })
        await waitJobs(servers)
      })
    })

    describe('With watched words', function () {
      let accountListId: number

      it('Should create watched words list and automatically assign an automatic tag', async function () {
        // Account list
        {
          await servers[0].watchedWordsLists.createList({ listName: 'list 1', words: [ 'word 1', 'word 2' ], accountName: 'root' })

          const { watchedWordsList } = await servers[0].watchedWordsLists.createList({
            listName: 'list 2',
            words: [ 'nemo' ],
            accountName: 'root'
          })
          accountListId = watchedWordsList.id
        }

        // Server list
        {
          await servers[0].watchedWordsLists.createList({ listName: 'server 2', words: [ 'word 2' ] })
        }

        await servers[0].comments.createThread({ videoId: videoUUID, text: 'hi captain' })
        await servers[0].comments.addReplyToLastThread({ text: 'hi captain nemo' })
        await servers[1].comments.createThread({ videoId: videoUUID, text: 'hi captain nemo word 2 example.com' })

        await waitJobs(servers)

        // Server comments list must not include account personal watched words
        {
          const { data } = await servers[0].comments.listForAdmin()
          const c = (text: string) => data.find(c => c.text === text)

          expect(c('hi captain').automaticTags).to.have.lengthOf(0)
          expect(c('hi captain nemo').automaticTags).to.have.lengthOf(0)
          expect(c('hi captain nemo word 2 example.com').automaticTags).to.have.members([ 'server 2', 'external-link' ])
        }

        {
          const { data } = await servers[0].comments.listCommentsOnMyVideos()
          const c = (text: string) => data.find(c => c.text === text)

          expect(c('hi captain').automaticTags).to.have.lengthOf(0)
          expect(c('hi captain nemo').automaticTags).to.have.members([ 'list 2' ])
          expect(c('hi captain nemo word 2 example.com').automaticTags).to.have.members([ 'list 1', 'list 2', 'external-link' ])
        }
      })

      it('Should update watched words list and assign auto tag with new words', async function () {
        // No tags
        {
          await servers[0].comments.createThread({ videoId: videoUUID, text: 'my nautilus' })

          const { data } = await servers[0].comments.listCommentsOnMyVideos()
          expect(data.find(c => c.text === 'my nautilus').automaticTags).to.have.lengthOf(0)
        }

        {
          await servers[0].watchedWordsLists.updateList({
            accountName: 'root',
            listId: accountListId,
            words: [ 'nautilus' ],
            listName: 'list 3'
          })

          await servers[0].comments.createThread({ videoId: videoUUID, text: 'captain nemo' })
          await servers[0].comments.createThread({ videoId: videoUUID, text: 'my nautilus 2' })
          await servers[0].comments.createThread({ videoId: videoUUID, text: 'word 1' })

          const { data } = await servers[0].comments.listCommentsOnMyVideos()
          // Previous comment still have the same automatic tags
          expect(data.find(c => c.text === 'my nautilus').automaticTags).to.have.lengthOf(0)

          expect(data.find(c => c.text === 'captain nemo').automaticTags).to.have.lengthOf(0)
          expect(data.find(c => c.text === 'my nautilus 2').automaticTags).to.have.members([ 'list 3' ])
          expect(data.find(c => c.text === 'word 1').automaticTags).to.have.members([ 'list 1' ])
        }
      })

      it('Should delete watched words list and so not assign auto tags anymore', async function () {
        await servers[0].watchedWordsLists.deleteList({ accountName: 'root', listId: accountListId })

        await servers[0].comments.createThread({ videoId: videoUUID, text: 'my nautilus 3' })
        await servers[0].comments.createThread({ videoId: videoUUID, text: 'word 2' })

        const { data } = await servers[0].comments.listCommentsOnMyVideos()
        expect(data.find(c => c.text === 'my nautilus 3').automaticTags).to.have.lengthOf(0)
        expect(data.find(c => c.text === 'word 2').automaticTags).to.have.members([ 'list 1' ])
      })
    })

    describe('Searching comments with specific tags', function () {

      it('Should search in "comments on my videos" comments with specific automatic tags', async function () {
        {
          const { total, data } = await servers[0].comments.listCommentsOnMyVideos({ autoTagOneOf: [ 'unknown' ] })
          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        {
          for (const autoTagOneOf of [ [ 'list 1' ], [ 'list 1', 'unknown' ] ]) {
            const { total, data } = await servers[0].comments.listCommentsOnMyVideos({ autoTagOneOf })

            expect(total).to.equal(3)

            expect(data.map(c => c.text)).to.have.members([
              'hi captain nemo word 2 example.com',
              'word 1',
              'word 2'
            ])
          }
        }
      })

      it('Should search in admin comments with specific automatic tags', async function () {
        {
          const { total, data } = await servers[0].comments.listForAdmin({ autoTagOneOf: [ 'list 1' ] })

          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        {
          const { total, data } = await servers[0].comments.listForAdmin({ autoTagOneOf: [ 'external-link' ] })

          expect(total).to.equal(1)
          expect(data).to.have.lengthOf(1)
          expect(data[0].text).to.equal('hi captain nemo word 2 example.com')
        }
      })
    })

  })

  describe('Automatic tags on videos', function () {

    before(async function () {
      await servers[0].videos.removeAll()

      await waitJobs(servers)
    })

    describe('Built in external link auto tag', function () {

      it('Should not assign external-link automatic tag with no URL inside the video', async function () {
        const tests = [
          'my super video',
          'toto.azfazfe',
          'Hello. Hi friends'
        ]

        for (const toTest of tests) {
          await servers[0].videos.upload({ attributes: { name: toTest, description: toTest } })
          await waitJobs(servers)
        }

        for (const server of servers) {
          const { data } = await server.videos.listAllForAdmin()

          for (const video of data) {
            expect(video.automaticTags, `"${video.name}" has an automatic tag`).to.have.lengthOf(0)
          }
        }

        await servers[0].videos.removeAll()
        await waitJobs(servers)
      })

      it('Should not assign external-link automatic tag if the URL is an internal link', async function () {
        const tests = [
          `Hi ${servers[0].url}`
        ]

        for (const toTest of tests) {
          await servers[0].videos.upload({ attributes: { name: toTest, description: toTest } })
          await waitJobs(servers)
        }

        // Server 1
        {
          const { data } = await servers[0].videos.listAllForAdmin()

          for (const video of data) {
            expect(video.automaticTags, `"${video.name}" has an automatic tag`).to.have.lengthOf(0)
          }
        }

        // Server 2
        {
          const { data } = await servers[1].videos.listAllForAdmin()

          for (const video of data) {
            expect(video.automaticTags, `"${video.name}" hasn't an automatic tag`).to.have.lengthOf(1)
            expect(video.automaticTags[0]).to.equal('external-link')
          }
        }

        await servers[0].videos.removeAll()
        await waitJobs(servers)
      })

      it('Should assign external-link automatic tag', async function () {
        const tests = [
          'example.com',
          'Hi example.com'
        ]

        for (const toTest of tests) {
          await servers[0].videos.upload({ attributes: { name: toTest, description: toTest } })
          await waitJobs(servers)
        }

        for (const server of servers) {
          const { data } = await server.videos.listAllForAdmin()

          for (const video of data) {
            expect(video.automaticTags).to.have.lengthOf(1)
            expect(video.automaticTags[0]).to.equal('external-link')
          }
        }

        await servers[0].videos.removeAll()
        await waitJobs(servers)
      })
    })

    describe('With watched words', function () {
      let serverListId: number
      let liveUUID: string

      it('Should create watched words list and automatically assign an automatic tag', async function () {
        // Server list
        {
          await servers[0].watchedWordsLists.createList({
            listName: 'donald list',
            words: [ 'riri', 'fifi', 'loulou' ]
          })

          const { watchedWordsList } = await servers[0].watchedWordsLists.createList({
            listName: 'mickey list',
            words: [ 'dingo', 'pluto' ]
          })
          serverListId = watchedWordsList.id
        }

        // Account list
        {
          await servers[0].watchedWordsLists.createList({ listName: 'picsou list', words: [ 'goldie' ], accountName: 'root' })
        }

        await servers[0].videos.upload({ attributes: { name: 'my dear goldie', description: 'hi riri and fifi' } })
        await servers[0].videoImports.importVideo({
          attributes: {
            targetUrl: FIXTURE_URLS.goodVideo,
            channelId: servers[0].store.channel.id,
            name: 'import video',
            description: 'pluto dog'
          }
        })
        const { uuid } = await servers[1].live.create({
          fields: {
            channelId: servers[0].store.channel.id,
            privacy: VideoPrivacy.PUBLIC,
            name: 'live loulou',
            description: 'dingo and minnie'
          }
        })
        liveUUID = uuid

        await waitJobs(servers)

        // Server videos list must not include account personal watched words
        {
          const { data } = await servers[0].videos.listAllForAdmin()
          const v = (name: string) => data.find(c => c.name === name)

          expect(v('my dear goldie').automaticTags).to.have.members([ 'donald list' ])
          expect(v('import video').automaticTags).to.have.members([ 'mickey list' ])
          expect(v('live loulou').automaticTags).to.have.members([ 'donald list', 'mickey list' ])
        }

        {
          const { data } = await servers[0].videos.listMyVideos()

          for (const video of data) {
            expect(video.automaticTags).to.not.exist
          }
        }
      })

      it('Should update watched words list and assign auto tag on update', async function () {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'hi minnie' })

        {
          const { data } = await servers[0].videos.listAllForAdmin()
          expect(data.find(v => v.name === 'hi minnie').automaticTags).to.have.lengthOf(0)
        }

        {
          await servers[0].watchedWordsLists.updateList({
            listId: serverListId,
            words: [ 'Minnie' ],
            listName: 'mickey list v2'
          })

          await servers[0].videos.update({ id: uuid, attributes: { name: 'hi minnie v2' } })

          const { data } = await servers[0].videos.listAllForAdmin()
          expect(data.find(v => v.name === 'hi minnie v2').automaticTags).to.have.members([ 'mickey list v2' ])
        }
      })

      it('Should not update remote video if name/description has not changed', async function () {
        await servers[1].videos.update({
          id: liveUUID,
          attributes: {
            channelId: servers[0].store.channel.id,
            tags: [ 'super tag' ]
          }
        })

        await waitJobs(servers)

        const { data } = await servers[0].videos.listAllForAdmin()
        expect(data.find(v => v.name === 'live loulou').automaticTags).to.have.members([ 'donald list', 'mickey list' ])
      })

      it('Should update remote video if name/description has changed', async function () {
        await servers[1].videos.update({
          id: liveUUID,
          attributes: { name: 'live loulou v2' }
        })

        await waitJobs(servers)

        const { data } = await servers[0].videos.listAllForAdmin()
        expect(data.find(v => v.name === 'live loulou v2').automaticTags).to.have.members([ 'donald list', 'mickey list v2' ])
      })
    })

    describe('Searching videos with specific tags', function () {

      it('Should search in admin videos with specific automatic tags', async function () {
        {
          const { total, data } = await servers[0].videos.listAllForAdmin({ autoTagOneOf: [ 'picsou list' ] })

          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        {
          const { total, data } = await servers[0].videos.listAllForAdmin({ autoTagOneOf: [ 'mickey list v2' ] })

          expect(total).to.equal(2)
          expect(data).to.have.lengthOf(2)

          expect(data.map(d => d.name)).to.have.members([ 'hi minnie v2', 'live loulou v2' ])
        }
      })
    })

  })

  after(async function () {
    await cleanupTests(servers)
  })
})
