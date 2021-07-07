/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { join } from 'path'
import { root } from '@server/helpers/core-utils'
import { ServerInfo } from '../server'

async function expectAccountFollows (options: {
  server: ServerInfo
  handle: string
  followers: number
  following: number
}) {
  const { server, handle, followers, following } = options

  const body = await server.accountsCommand.list()
  const account = body.data.find(a => a.name + '@' + a.host === handle)

  const message = `${handle} on ${server.url}`
  expect(account.followersCount).to.equal(followers, message)
  expect(account.followingCount).to.equal(following, message)
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
  checkActorFilesWereRemoved
}
