/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  quitFriends,
  wait,
  setAccessTokensToServers,
  flushAndRunMultipleServers,
  killallServers,
  makeFriends,
  getFriendsList,
  dateIsValid,
  quitOneFriend,
  getPodsListPaginationAndSort
} from '../utils'

describe('Test basic friends', function () {
  let servers = []

  function makeFriendsWrapper (podNumber: number) {
    const server = servers[podNumber - 1]
    return makeFriends(server.url, server.accessToken)
  }

  async function testMadeFriends (servers: ServerInfo[], serverToTest: ServerInfo) {
    const friends = []
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].url === serverToTest.url) continue
      friends.push(servers[i].host)
    }

    const res = await getFriendsList(serverToTest.url)

    const result = res.body.data
    expect(result).to.be.an('array')
    expect(result.length).to.equal(2)

    const resultHosts = [ result[0].host, result[1].host ]
    expect(resultHosts[0]).to.not.equal(resultHosts[1])

    const errorString = 'Friends host do not correspond for ' + serverToTest.host
    expect(friends).to.contain(resultHosts[0], errorString)
    expect(friends).to.contain(resultHosts[1], errorString)
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    await setAccessTokensToServers(servers)
  })

  it('Should not have friends', async function () {
    for (const server of servers) {
      const res = await getFriendsList(server.url)

      const result = res.body.data
      expect(result).to.be.an('array')
      expect(result.length).to.equal(0)
    }
  })

  it('Should make friends', async function () {
    this.timeout(120000)

    // The second pod make friend with the third
    await makeFriendsWrapper(2)

    // Wait for the request between pods
    await wait(11000)

    // The second pod should have the third as a friend
    const res1 = await getFriendsList(servers[1].url)

    const friends = res1.body.data
    expect(friends).to.be.an('array')
    expect(friends.length).to.equal(1)

    const pod1 = friends[0]
    expect(pod1.host).to.equal(servers[2].host)
    expect(pod1.email).to.equal('admin3@example.com')
    expect(pod1.score).to.equal(20)
    expect(dateIsValid(pod1.createdAt)).to.be.true

    // Same here, the third pod should have the second pod as a friend
    const res2 = await getFriendsList(servers[2].url)
    const result = res2.body.data
    expect(result).to.be.an('array')
    expect(result.length).to.equal(1)

    const pod2 = result[0]
    expect(pod2.host).to.equal(servers[1].host)
    expect(pod2.email).to.equal('admin2@example.com')
    expect(pod2.score).to.equal(20)
    expect(dateIsValid(pod2.createdAt)).to.be.true

    // Finally the first pod make friend with the second pod
    await makeFriendsWrapper(1)

    // Wait for the request between pods
    await wait(11000)

    // Now each pod should be friend with the other ones
    for (const server of servers) {
      await testMadeFriends(servers, server)
    }
  })

  it('Should not be allowed to make friend again', async function () {
    this.timeout(10000)

    const server = servers[1]
    await makeFriends(server.url, server.accessToken, 409)
  })

  it('Should list friends correctly', async function () {
    const start = 1
    const count = 1
    const sort = '-host'

    const res = await getPodsListPaginationAndSort(servers[0].url, start, count, sort)
    expect(res.body.total).to.equal(2)
    expect(res.body.data).to.have.lengthOf(1)

    const pod = res.body.data[0]
    expect(pod.host).to.equal('localhost:9002')
    expect(pod.email).to.equal('admin2@example.com')
    expect(pod.score).to.equal(20)
    expect(dateIsValid(pod.createdAt)).to.be.true
  })

  it('Should quit friends of pod 2', async function () {
    this.timeout(10000)

    // Pod 1 quit friends
    await quitFriends(servers[1].url, servers[1].accessToken)

    // Pod 1 should not have friends anymore
    const res = await getFriendsList(servers[1].url)
    const friends = res.body.data
    expect(friends).to.be.an('array')
    expect(friends).to.have.lengthOf(0)

    // Other pods shouldn't have pod 1 too
    const serversToTest = [ servers[0].url, servers[2].url ]
    for (const url of serversToTest) {
      const res = await getFriendsList(url)
      const friends = res.body.data

      expect(friends).to.be.an('array')
      expect(friends.length).to.equal(1)
      expect(friends[0].host).not.to.be.equal(servers[1].host)
    }
  })

  it('Should allow pod 2 to make friend again', async function () {
    this.timeout(120000)

    const server = servers[1]
    await makeFriends(server.url, server.accessToken)
    await wait(11000)

    for (const server of servers) {
      await testMadeFriends(servers, server)
    }
  })

  it('Should allow pod 1 to quit only pod 2', async function () {
    // Pod 1 quits pod 2
    const server = servers[0]

    // Get pod 2 id so we can query it
    const res1 = await getFriendsList(server.url)
    const friends1 = res1.body.data
    let pod1 = friends1.find(friend => (friend.host === servers[1].host))

    // Remove it from the friends list
    await quitOneFriend(server.url, server.accessToken, pod1.id)

    // Pod 1 should have only pod 3 in its friends list
    const res2 = await getFriendsList(servers[0].url)
    const friends2 = res2.body.data
    expect(friends2).to.be.an('array')
    expect(friends2.length).to.equal(1)

    const pod2 = friends2[0]
    expect(pod2.host).to.equal(servers[2].host)

    // Pod 2 should have only pod 3 in its friends list
    const res3 = await getFriendsList(servers[1].url)
    const friends3 = res3.body.data
    expect(friends3).to.be.an('array')
    expect(friends3.length).to.equal(1)

    const pod = friends3[0]
    expect(pod.host).to.equal(servers[2].host)

    // Pod 3 should have both pods in its friends list
    const res4 = await getFriendsList(servers[2].url)
    const friends4 = res4.body.data
    expect(friends4).to.be.an('array')
    expect(friends4.length).to.equal(2)
  })

  after(async function () {
    killallServers(servers)

    if (this['ok']) {
      await flushTests()
    }
  })
})
