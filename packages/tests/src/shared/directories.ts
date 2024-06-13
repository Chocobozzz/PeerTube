/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { PeerTubeRunnerProcess } from './peertube-runner-process.js'

export async function checkTmpIsEmpty (server: PeerTubeServer) {
  await checkDirectoryIsEmpty(server, 'tmp', [ 'plugins-global.css', 'hls', 'resumable-uploads' ])

  if (await pathExists(server.getDirectoryPath('tmp/hls'))) {
    await checkDirectoryIsEmpty(server, 'tmp/hls')
  }
}

export async function checkPersistentTmpIsEmpty (server: PeerTubeServer) {
  await checkDirectoryIsEmpty(server, 'tmp-persistent')
}

export async function checkDirectoryIsEmpty (server: PeerTubeServer, directory: string, exceptions: string[] = []) {
  const directoryPath = server.getDirectoryPath(directory)

  const directoryExists = await pathExists(directoryPath)
  expect(directoryExists).to.be.true

  const files = await readdir(directoryPath)
  const filtered = files.filter(f => exceptions.includes(f) === false)

  expect(filtered).to.have.lengthOf(0)
}

export async function checkPeerTubeRunnerCacheIsEmpty (runner: PeerTubeRunnerProcess, subDir: 'transcoding' | 'transcription') {
  const directoryPath = join(homedir(), '.cache', 'peertube-runner-nodejs', runner.getId(), subDir)

  const directoryExists = await pathExists(directoryPath)
  expect(directoryExists).to.be.true

  const files = await readdir(directoryPath)

  expect(files, `Sub-directory ${subDir} content: ${files.join(', ')}`).to.have.lengthOf(0)
}
