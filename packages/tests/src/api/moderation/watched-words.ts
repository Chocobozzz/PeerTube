/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test watched words', function () {
  let server: PeerTubeServer
  let userToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])

    userToken = await server.users.generateUserAndToken('user1')
  })

  function runTests (mode: 'server' | 'account') {
    let listId: number
    let accountName: string
    let token: string

    before(() => {
      accountName = mode === 'server'
        ? undefined
        : 'user1'

      token = mode === 'server'
        ? server.accessToken
        : userToken
    })

    it('Should list empty watched words', async function () {
      const { data, total } = await server.watchedWordsLists.listWordsLists({ token, accountName })

      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should add watched words lists', async function () {
      {
        const { watchedWordsList } = await server.watchedWordsLists.createList({
          token,
          listName: 'list user one',
          words: [ 'word1' ],
          accountName
        })

        listId = watchedWordsList.id
      }

      {
        await server.watchedWordsLists.createList({
          token,
          listName: 'list user two',
          words: [ 'word2', 'word3' ],
          accountName
        })
      }

      if (mode === 'account') {
        await server.watchedWordsLists.createList({
          listName: 'list one',
          words: [ 'word4', 'word5' ],
          accountName: 'root'
        })
      }
    })

    it('Should list watched words', async function () {
      if (mode === 'account') {
        const { data, total } = await server.watchedWordsLists.listWordsLists({ accountName: 'root' })

        expect(total).to.equal(1)

        expect(data).to.have.lengthOf(1)
        expect(data[0].id).to.exist
        expect(data[0].createdAt).to.exist
        expect(data[0].updatedAt).to.exist
        expect(data[0].listName).to.equal('list one')
        expect(data[0].words).to.deep.equal([ 'word4', 'word5' ])
      }

      // With sort, start, count
      {
        const { data, total } = await server.watchedWordsLists.listWordsLists({
          token,
          accountName,
          sort: 'createdAt'
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        expect(data[0].listName).to.equal('list user one')
        expect(data[0].words).to.deep.equal([ 'word1' ])

        expect(data[1].listName).to.equal('list user two')
        expect(data[1].words).to.deep.equal([ 'word2', 'word3' ])
      }

      {
        const { data, total } = await server.watchedWordsLists.listWordsLists({
          token,
          accountName,
          sort: '-listName'
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        expect(data[0].listName).to.equal('list user two')
        expect(data[1].listName).to.equal('list user one')
      }

      {
        const { data, total } = await server.watchedWordsLists.listWordsLists({
          accountName,
          token,
          sort: '-listName',
          start: 1,
          count: 1
        })

        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(1)

        expect(data[0].listName).to.equal('list user one')
      }
    })

    it('Should update watched words lists', async function () {
      await server.watchedWordsLists.updateList({
        listId,
        token,
        accountName,
        words: [ 'updated-word1', 'updated-word2' ]
      })

      await server.watchedWordsLists.updateList({
        listId,
        token,
        accountName,
        listName: 'updated-list'
      })

      const { data } = await server.watchedWordsLists.listWordsLists({ token, accountName })
      const list = data.find(l => l.id === listId)

      expect(list.listName).to.equal('updated-list')
      expect(list.words).to.deep.equal([ 'updated-word1', 'updated-word2' ])
    })

    it('Should delete watched words lists', async function () {
      await server.watchedWordsLists.deleteList({
        listId,
        token,
        accountName
      })

      const { total, data } = await server.watchedWordsLists.listWordsLists({ token, accountName })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const list = data.find(l => l.id === listId)
      expect(list).to.not.exist
    })
  }

  describe('Managing account watched words', function () {
    runTests('account')
  })

  describe('Managing instance watched words', function () {
    runTests('server')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
