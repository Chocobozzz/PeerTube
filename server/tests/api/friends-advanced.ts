/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  runServer,
  uploadVideo,
  quitFriends,
  getVideosList,
  wait,
  setAccessTokensToServers,
  flushAndRunMultipleServers,
  killallServers,
  makeFriends,
  getFriendsList,
  quitOneFriend
} from '../utils'

describe('Test advanced friends', function () {
  let servers: ServerInfo[] = []

  async function makeFriendsWrapper (podNumber: number) {
    const server = servers[podNumber - 1]
    return makeFriends(server.url, server.accessToken)
  }

  async function quitFriendsWrapper (podNumber: number) {
    const server = servers[podNumber - 1]
    return quitFriends(server.url, server.accessToken)
  }

  async function removeFriendWrapper (podNumber: number, podNumberToRemove: number) {
    const server = servers[podNumber - 1]
    const serverToRemove = servers[podNumberToRemove - 1]

    const res = await getFriendsList(server.url)

    let friendsList = res.body.data
    let podToRemove = friendsList.find(friend => (friend.host === serverToRemove.host))

    return quitOneFriend(server.url, server.accessToken, podToRemove.id)
  }

  async function getFriendsListWrapper (podNumber: number) {
    const server = servers[podNumber - 1]
    return getFriendsList(server.url)
  }

  async function uploadVideoWrapper (podNumber: number) {
    const videoAttributes = {
      tags: [ 'tag1', 'tag2' ]
    }
    const server = servers[podNumber - 1]

    return uploadVideo(server.url, server.accessToken, videoAttributes)
  }

  async function getVideosWrapper (podNumber: number) {
    return getVideosList(servers[podNumber - 1].url)
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(6)
    await setAccessTokensToServers(servers)
  })

  it('Should not make friends with two different groups', async function () {
    this.timeout(20000)

    // Pod 3 makes friend with the first one
    await makeFriendsWrapper(3)

    // Pod 4 makes friend with the second one
    await makeFriendsWrapper(4)

    // Now if the fifth wants to make friends with the third and the first
    await makeFriendsWrapper(5)

    await wait(11000)

      // It should have 0 friends
    const res = await getFriendsListWrapper(5)
    expect(res.body.data.length).to.equal(0)
  })

  it('Should quit all friends', async function () {
    this.timeout(10000)

    await quitFriendsWrapper(1)
    await quitFriendsWrapper(2)

    const serverNumbersToTest = [ 1, 2, 3, 4, 5, 6 ]
    for (const i of serverNumbersToTest) {
      const res = await getFriendsListWrapper(i)
      expect(res.body.data.length).to.equal(0)
    }
  })

  it('Should remove bad pod and new pod should not become friend with it', async function () {
    this.timeout(200000)

    // Pods 1, 2, 3 and 4 become friends
    await makeFriendsWrapper(2)
    await makeFriendsWrapper(1)
    await makeFriendsWrapper(4)

    // Check the pods 1, 2, 3 and 4 are friends
    let serverNumbersToTest = [ 1, 2, 3, 4 ]
    for (const i of serverNumbersToTest) {
      const res = await getFriendsListWrapper(i)
      expect(res.body.data.length).to.equal(3)
    }

    // Wait initial video channel requests
    await wait(11000)

    // Kill pod 4
    servers[3].app.kill()

    // Remove pod 4 from pod 1 and 2
    await uploadVideoWrapper(1)
    await uploadVideoWrapper(2)

    await wait(11000)

    await uploadVideoWrapper(1)
    await uploadVideoWrapper(2)

    await wait(11000)

    await uploadVideoWrapper(1)
    await uploadVideoWrapper(2)

    await wait(11000)

    await uploadVideoWrapper(1)
    await uploadVideoWrapper(2)

    await wait(11000)

    serverNumbersToTest = [ 1, 2 ]

    for (const i of serverNumbersToTest) {
      const res = await getFriendsListWrapper(i)

      // Pod 4 should not be our friend
      const friends = res.body.data
      expect(friends.length).to.equal(2)

      for (const pod of friends) {
        expect(pod.host).not.equal(servers[3].host)
      }
    }

    // Rerun server 4
    const newServer = await runServer(4)
    servers[3].app = newServer.app
    servers[3].app

    // Pod 4 didn't know pod 1 and 2 removed it
    const res1 = await getFriendsListWrapper(4)
    expect(res1.body.data.length).to.equal(3)

    // Pod 3 didn't upload video, it's still friend with pod 3
    const res2 = await getFriendsListWrapper(3)
    expect(res2.body.data.length).to.equal(3)

    // Pod 6 asks pod 1, 2 and 3
    await makeFriendsWrapper(6)

    await wait(11000)

    const res3 = await getFriendsListWrapper(6)

    // Pod 4 should not be our friend
    const friends = res3.body.data
    expect(friends.length).to.equal(3)
    for (const pod of friends) {
      expect(pod.host).not.equal(servers[3].host)
    }
  })

  // Pod 1 is friend with : 2 3 6
  // Pod 2 is friend with : 1 3 6
  // Pod 3 is friend with : 1 2 4 6
  // Pod 4 is friend with : 1 2 3
  // Pod 6 is friend with : 1 2 3
  it('Should pod 1 quit friends', async function () {
    this.timeout(25000)

    // Upload a video on server 3 for additional tests
    await uploadVideoWrapper(3)

    await wait(15000)

    // Pod 1 remove friends
    await quitFriendsWrapper(1)

    const res1 = await getVideosWrapper(1)
    const videos1 = res1.body.data
    expect(videos1).to.be.an('array')
    expect(videos1.length).to.equal(4)

    const res2 = await getVideosWrapper(2)
    const videos2 = res2.body.data
    expect(videos2).to.be.an('array')
    expect(videos2.length).to.equal(5)
  })

  // Pod 1 is friend with nothing
  // Pod 2 is friend with : 3 6
  // Pod 3 is friend with : 2 4 6
  // Pod 4 is friend with : 2 3
  // Pod 6 is friend with : 2 3
  it('Should make friends between pod 1, 2, 3 and 6 and exchange their videos', async function () {
    this.timeout(30000)

    await makeFriendsWrapper(1)

    await wait(22000)

    const res = await getVideosWrapper(1)
    const videos = res.body.data
    expect(videos).to.be.an('array')
    expect(videos.length).to.equal(9)
  })

  // Pod 1 is friend with : 2 3 6
  // Pod 2 is friend with : 1 3 6
  // Pod 3 is friend with : 1 2 4 6
  // Pod 4 is friend with : 2 3
  // Pod 6 is friend with : 1 2 3
  it('Should allow pod 6 to quit pod 1, 2 and 3 and be friend with pod 3', async function () {
    this.timeout(30000)

    // Pod 3 should have 4 friends
    const res1 = await getFriendsListWrapper(3)
    const friendsList1 = res1.body.data
    expect(friendsList1).to.be.an('array')
    expect(friendsList1.length).to.equal(4)

    // Pod 1, 2, 6 should have 3 friends each
    let serverNumbersToTest = [ 1, 2, 6 ]
    for (const i of serverNumbersToTest) {
      const res = await getFriendsListWrapper(i)
      const friendsList = res.body.data
      expect(friendsList).to.be.an('array')
      expect(friendsList.length).to.equal(3)
    }

    await removeFriendWrapper(6, 1)
    await removeFriendWrapper(6, 2)

    // Pod 6 should now have only 1 friend (and it should be Pod 3)
    const res2 = await getFriendsListWrapper(6)
    const friendsList2 = res2.body.data
    expect(friendsList2).to.be.an('array')
    expect(friendsList2.length).to.equal(1)
    expect(friendsList2[0].host).to.equal(servers[2].host)

    // Pod 1 & 2 should not know friend 6 anymore
    serverNumbersToTest = [ 1, 2 ]
    for (const i of serverNumbersToTest) {
      const res = await getFriendsListWrapper(i)
      const friendsList = res.body.data
      expect(friendsList).to.be.an('array')
      expect(friendsList.length).to.equal(2)
    }

    // Pod 3 should know every pod
    const res3 = await getFriendsListWrapper(3)
    const friendsList3 = res3.body.data
    expect(friendsList3).to.be.an('array')
    expect(friendsList3.length).to.equal(4)
  })

  after(async function () {
    killallServers(servers)

    if (this['ok']) {
      await flushTests()
    }
  })
})
