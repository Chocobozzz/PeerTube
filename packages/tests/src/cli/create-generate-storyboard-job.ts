/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { remove } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '../shared/sql-command.js'

function listStoryboardFiles (server: PeerTubeServer) {
  const storage = server.getDirectoryPath('storyboards')

  return readdir(storage)
}

describe('Test create generate storyboard job CLI', function () {
  let servers: PeerTubeServer[] = []
  const uuids: string[] = []
  let sql: SQLCommand
  let existingStoryboardName: string

  before(async function () {
    this.timeout(120000)

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    for (let i = 0; i < 3; i++) {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video ' + i })
      uuids.push(uuid)
    }

    await waitJobs(servers)

    const storage = servers[0].getDirectoryPath('storyboards')
    for (const storyboard of await listStoryboardFiles(servers[0])) {
      await remove(join(storage, storyboard))
    }

    sql = new SQLCommand(servers[0])
    await sql.deleteAll('storyboard')

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video 4' })
    uuids.push(uuid)

    await waitJobs(servers)

    const storyboards = await listStoryboardFiles(servers[0])
    existingStoryboardName = storyboards[0]
  })

  it('Should create a storyboard of a video', async function () {
    this.timeout(120000)

    for (const uuid of [ uuids[0], uuids[3] ]) {
      const command = `npm run create-generate-storyboard-job -- -v ${uuid}`
      await servers[0].cli.execWithEnv(command)
    }

    await waitJobs(servers)

    {
      const storyboards = await listStoryboardFiles(servers[0])
      expect(storyboards).to.have.lengthOf(2)
      expect(storyboards).to.not.include(existingStoryboardName)

      existingStoryboardName = storyboards[0]
    }

    for (const server of servers) {
      for (const uuid of [ uuids[0], uuids[3] ]) {
        const { storyboards } = await server.storyboard.list({ id: uuid })
        expect(storyboards).to.have.lengthOf(1)

        await makeGetRequest({ url: server.url, path: storyboards[0].storyboardPath, expectedStatus: HttpStatusCode.OK_200 })
      }
    }
  })

  it('Should create missing storyboards', async function () {
    this.timeout(120000)

    const command = `npm run create-generate-storyboard-job -- -a`
    await servers[0].cli.execWithEnv(command)

    await waitJobs(servers)

    {
      const storyboards = await listStoryboardFiles(servers[0])
      expect(storyboards).to.have.lengthOf(4)
      expect(storyboards).to.include(existingStoryboardName)
    }

    for (const server of servers) {
      for (const uuid of uuids) {
        const { storyboards } = await server.storyboard.list({ id: uuid })
        expect(storyboards).to.have.lengthOf(1)

        await makeGetRequest({ url: server.url, path: storyboards[0].storyboardPath, expectedStatus: HttpStatusCode.OK_200 })
      }
    }
  })

  after(async function () {
    await sql.cleanup()

    await cleanupTests(servers)
  })
})
