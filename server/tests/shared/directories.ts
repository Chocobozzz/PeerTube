/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { PeerTubeServer } from '@shared/server-commands'

async function checkTmpIsEmpty (server: PeerTubeServer) {
  await checkDirectoryIsEmpty(server, 'tmp', [ 'plugins-global.css', 'hls', 'resumable-uploads' ])

  if (await pathExists(server.getDirectoryPath('tmp/hls'))) {
    await checkDirectoryIsEmpty(server, 'tmp/hls')
  }
}

async function checkDirectoryIsEmpty (server: PeerTubeServer, directory: string, exceptions: string[] = []) {
  const directoryPath = server.getDirectoryPath(directory)

  const directoryExists = await pathExists(directoryPath)
  expect(directoryExists).to.be.true

  const files = await readdir(directoryPath)
  const filtered = files.filter(f => exceptions.includes(f) === false)

  expect(filtered).to.have.lengthOf(0)
}

export {
  checkTmpIsEmpty,
  checkDirectoryIsEmpty
}
