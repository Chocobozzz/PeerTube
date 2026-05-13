/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockWatchedWords } from '@tests/shared/mock-servers/mock-watched-words.js'
import { expect } from 'chai'

describe('Test watched words subscriptions', function () {
  let server: PeerTubeServer
  let mockServer: MockWatchedWords
  let mockPort: number
  let userToken: string
  let moderatorToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])

    mockServer = new MockWatchedWords()
    mockPort = await mockServer.initialize()

    userToken = await server.users.generateUserAndToken('user1')
    moderatorToken = await server.users.generateUserAndToken('moderator', UserRole.MODERATOR)
  })

  function runTests (mode: 'server' | 'account') {
    let subscriptionId: number
    let accountName: string
    let token: string

    before(() => {
      accountName = mode === 'server'
        ? undefined
        : 'user1'

      token = mode === 'server'
        ? moderatorToken
        : userToken

      mockServer.setName('Remote watched words')
      mockServer.setActions([])
    })

    it('Should list empty subscriptions', async function () {
      const { data, total } = await server.watchedWordsLists.listWordsSubscriptions({ token, accountName })

      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should add a subscription', async function () {
      const subscription = await server.watchedWordsLists.createSubscription({
        token,
        accountName,
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json`
      })

      expect(subscription.name).to.equal('Remote watched words')
      expect(subscription.url).to.equal(`http://127.0.0.1:${mockPort}/list.json`)
      expect(subscription.importedWordsCount).to.equal(0)

      subscriptionId = subscription.id
    })

    it('Should list subscriptions', async function () {
      const { data, total } = await server.watchedWordsLists.listWordsSubscriptions({ token, accountName })

      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('Remote watched words')
      expect(data[0].lastSyncAt).to.be.null
      expect(data[0].importedWordsCount).to.equal(0)
    })

    it('Should synchronize watched words and rename the imported list', async function () {
      this.timeout(120000)

      const now = Date.now()
      const videoName = `subscription video word2 ${mode}`
      const commentText = `subscription comment word2 ${mode}`

      const { uuid } = await server.videos.quickUpload({ token, name: videoName })
      await server.comments.createThread({ token, videoId: uuid, text: commentText })

      await waitJobs([ server ])

      {
        const { data } = await server.videos.listAllForAdmin()
        expect(data.find(v => v.name === videoName).automaticTags).to.have.lengthOf(0)
      }

      {
        const comments = mode === 'server'
          ? await server.comments.listForAdmin()
          : await server.comments.listCommentsOnMyVideos({ token })

        expect(comments.data.find(c => c.text === commentText).automaticTags).to.have.lengthOf(0)
      }

      mockServer.setActions([
        { type: 'add', word: 'word1', createdAt: new Date(now - 1000).toISOString() },
        { type: 'add', word: 'word2', createdAt: new Date(now - 500).toISOString() }
      ])

      await wait(8000)
      await waitJobs([ server ])

      {
        const { data, total } = await server.watchedWordsLists.listWordsLists({ token, accountName })

        expect(total).to.equal(1)
        expect(data[0].listName).to.equal('Remote watched words')
        expect(data[0].words).to.deep.equal([ 'word1', 'word2' ])
        expect(data[0].subscriptionUrl).to.equal(`http://127.0.0.1:${mockPort}/list.json`)
      }

      {
        const { data } = await server.watchedWordsLists.listWordsSubscriptions({ token, accountName })

        expect(data[0].importedWordsCount).to.equal(2)
        expect(data[0].state.label).to.be.oneOf([ 'Synchronized', 'Processing' ])
      }

      {
        const comments = mode === 'server'
          ? await server.comments.listForAdmin()
          : await server.comments.listCommentsOnMyVideos({ token })

        expect(comments.data.find(c => c.text === commentText).automaticTags).to.have.members([ 'Remote watched words' ])
      }

      {
        const { data } = await server.videos.listAllForAdmin()
        const automaticTags = data.find(v => v.name === videoName).automaticTags

        if (mode === 'server') expect(automaticTags).to.have.members([ 'Remote watched words' ])
        else expect(automaticTags).to.have.lengthOf(0)
      }

      mockServer.setName('Renamed watched words')
      mockServer.setActions([
        { type: 'add', word: 'word1', createdAt: new Date(now - 1000).toISOString() },
        { type: 'add', word: 'word2', createdAt: new Date(now - 500).toISOString() },
        { type: 'remove', word: 'word1', createdAt: new Date(now + 1000).toISOString() },
        { type: 'add', word: 'word3', createdAt: new Date(now + 2000).toISOString() }
      ])

      await wait(8000)
      await waitJobs([ server ])

      const { data } = await server.watchedWordsLists.listWordsLists({ token, accountName })
      expect(data).to.have.lengthOf(1)
      expect(data[0].listName).to.equal('Renamed watched words')
      expect(data[0].words).to.deep.equal([ 'word2', 'word3' ])
      expect(data[0].subscriptionUrl).to.equal(`http://127.0.0.1:${mockPort}/list.json`)

      {
        const comments = mode === 'server'
          ? await server.comments.listForAdmin()
          : await server.comments.listCommentsOnMyVideos({ token })

        expect(comments.data.find(c => c.text === commentText).automaticTags).to.have.members([ 'Renamed watched words' ])
      }

      {
        const { data } = await server.videos.listAllForAdmin()
        const automaticTags = data.find(v => v.name === videoName).automaticTags

        if (mode === 'server') expect(automaticTags).to.have.members([ 'Renamed watched words' ])
        else expect(automaticTags).to.have.lengthOf(0)
      }
    })

    it('Should delete a subscription and remove imported watched words', async function () {
      const unrelatedSubscription = await server.watchedWordsLists.createSubscription({
        token,
        accountName,
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list-2`
      })

      const unrelatedSubscriptionWithActions = await server.watchedWordsLists.createSubscription({
        token,
        accountName,
        subscriptionUrl: `http://127.0.0.1:${mockPort}/list-3`
      })

      await server.watchedWordsLists.createList({
        token,
        accountName,
        listName: 'Manual watched words list',
        words: [ 'manual-word' ]
      })

      await wait(8000)

      await server.watchedWordsLists.deleteSubscription({ token, accountName, id: subscriptionId })

      {
        const { total, data } = await server.watchedWordsLists.listWordsSubscriptions({ token, accountName })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        const subscriptionIds = data.map(subscription => subscription.id)
        const subscriptionNames = data.map(subscription => subscription.name)

        expect(subscriptionIds).to.include(unrelatedSubscription.id)
        expect(subscriptionIds).to.include(unrelatedSubscriptionWithActions.id)
        expect(subscriptionNames).to.include('Another watched words list')
        expect(subscriptionNames).to.include('Another watched words list with actions')
      }

      {
        const { total, data } = await server.watchedWordsLists.listWordsLists({ token, accountName })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        const manualList = data.find(list => list.listName === 'Manual watched words list')
        const unrelatedImportedList = data.find(list => list.listName === 'Another watched words list with actions')

        expect(manualList).to.not.be.undefined
        expect(unrelatedImportedList).to.not.be.undefined
        expect(manualList.words).to.deep.equal([ 'manual-word' ])
        expect(manualList.subscriptionUrl).to.be.null
        expect(unrelatedImportedList.words).to.deep.equal([ 'unrelated-word' ])
        expect(unrelatedImportedList.subscriptionUrl).to.equal(`http://127.0.0.1:${mockPort}/list-3`)
      }
    })
  }

  describe('Managing account watched words subscriptions', function () {
    runTests('account')
  })

  describe('Managing instance watched words subscriptions', function () {
    runTests('server')
  })

  after(async function () {
    await cleanupTests([ server ])
    await mockServer.terminate()
  })
})
