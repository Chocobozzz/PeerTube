/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { makeRawRequest, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

export async function checkStoryboard (options: {
  server: PeerTubeServer
  uuid: string
  spriteHeight?: number
  spriteWidth?: number
  tilesCount?: number
  minSize?: number
  spriteDuration?: number
}) {
  const { server, uuid, tilesCount, spriteDuration = 1, spriteHeight = 108, spriteWidth = 192, minSize = 1000 } = options

  const { storyboards } = await server.storyboard.list({ id: uuid })
  expect(storyboards).to.have.lengthOf(1)

  const storyboard = storyboards[0]

  expect(storyboard.spriteDuration).to.equal(spriteDuration)
  expect(storyboard.spriteHeight).to.equal(spriteHeight)
  expect(storyboard.spriteWidth).to.equal(spriteWidth)
  expect(storyboard.fileUrl).to.exist

  if (tilesCount) {
    expect(storyboard.totalWidth).to.equal(spriteWidth * Math.min(tilesCount, 11))
    expect(storyboard.totalHeight).to.equal(spriteHeight * Math.max(tilesCount / 11, 1))
  }

  {
    const { body } = await makeRawRequest({ url: storyboard.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    expect(body.length).to.be.above(minSize)
  }
}

export async function checkNoStoryboard (options: {
  server: PeerTubeServer
  uuid: string
}) {
  const { server, uuid } = options

  const { storyboards } = await server.storyboard.list({ id: uuid })

  expect(storyboards).to.have.lengthOf(0)
}
