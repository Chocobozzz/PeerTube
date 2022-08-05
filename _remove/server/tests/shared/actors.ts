/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { join } from 'path'
import { root } from '@shared/core-utils'
import { Account, VideoChannel } from '@shared/models'
import { PeerTubeServer } from '@shared/server-commands'

async function expectChannelsFollows (options: {
  server: PeerTubeServer
  handle: string
  followers: number
  following: number
}) {
  const { server } = options
  const { data } = await server.channels.list()

  return expectActorFollow({ ...options, data })
}

async function expectAccountFollows (options: {
  server: PeerTubeServer
  handle: string
  followers: number
  following: number
}) {
  const { server } = options
  const { data } = await server.accounts.list()

  return expectActorFollow({ ...options, data })
}

async function checkActorFilesWereRemoved (filename: string, serverNumber: number) {
  const testDirectory = 'test' + serverNumber

  for (const directory of [ 'avatars' ]) {
    const directoryPath = join(root(), testDirectory, directory)

    const directoryExists = await pathExists(directoryPath)
    expect(directoryExists).to.be.true

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(filename)
    }
  }
}

export {
  expectAccountFollows,
  expectChannelsFollows,
  checkActorFilesWereRemoved
}

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
