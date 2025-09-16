/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { Account, AccountSummary, HttpStatusCode, VideoChannel, VideoChannelSummary } from '@peertube/peertube-models'
import { makeRawRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir } from 'fs/promises'

export async function expectChannelsFollows (options: {
  server: PeerTubeServer
  handle: string
  followers: number
  following: number
}) {
  const { server } = options
  const { data } = await server.channels.list()

  return expectActorFollow({ ...options, data })
}

export async function expectAccountFollows (options: {
  server: PeerTubeServer
  handle: string
  followers: number
  following: number
}) {
  const { server } = options
  const { data } = await server.accounts.list()

  return expectActorFollow({ ...options, data })
}

export async function checkActorFilesWereRemoved (filename: string, server: PeerTubeServer) {
  for (const directory of [ 'avatars' ]) {
    const directoryPath = server.getDirectoryPath(directory)

    const directoryExists = await pathExists(directoryPath)
    expect(directoryExists).to.be.true

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(filename)
    }
  }
}

export async function checkActorImage (actor: AccountSummary | VideoChannelSummary) {
  expect(actor.avatars).to.have.lengthOf(4)

  for (const avatar of actor.avatars) {
    expect(avatar.createdAt).to.exist
    expect(avatar.fileUrl).to.exist
    expect(avatar.height).to.be.greaterThan(0)
    expect(avatar.width).to.be.greaterThan(0)
    expect(avatar.updatedAt).to.exist

    await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function expectActorFollow (options: {
  server: PeerTubeServer
  data: (Account | VideoChannel)[]
  handle: string
  followers: number
  following: number
}) {
  const { server, data, handle, followers, following } = options

  const actor = data.find(a => a.name + '@' + a.host === handle)
  const message = `${handle} on ${server.url}`

  expect(actor, message).to.exist
  expect(actor.followersCount).to.equal(followers, message)
  expect(actor.followingCount).to.equal(following, message)
}
