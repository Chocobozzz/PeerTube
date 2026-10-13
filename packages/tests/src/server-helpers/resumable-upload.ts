/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import { buildVideoUploadFileExtension } from '@peertube/peertube-server/core/helpers/upload.js'
import { resumableChunkSizeValidatorFactory } from '@peertube/peertube-server/core/middlewares/validators/resumable-upload.js'
import { expect } from 'chai'
import express from 'express'

describe('Resumable upload chunk size validator', function () {
  const minChunkSize = 1000

  function run (options: {
    contentRange?: string
    minChunkSize?: number
  }) {
    const validator = resumableChunkSizeValidatorFactory(() => options.minChunkSize ?? minChunkSize)

    let failStatus: number
    let nextCalled = false

    const req = { headers: { 'content-range': options.contentRange } } as unknown as express.Request
    const res = {
      fail: ({ status }) => {
        failStatus = status
      }
    } as unknown as express.Response

    validator(req, res, () => {
      nextCalled = true
    })

    return { nextCalled, failStatus }
  }

  it('Should accept a chunk of the min chunk size', async function () {
    expect(run({ contentRange: 'bytes 0-999/5000' }).nextCalled).to.be.true
    expect(run({ contentRange: 'bytes 1000-2999/5000' }).nextCalled).to.be.true
  })

  it('Should refuse a non final chunk smaller than the min chunk size', async function () {
    const { nextCalled, failStatus } = run({ contentRange: 'bytes 1000-1998/5000' })

    expect(nextCalled).to.be.false
    expect(failStatus).to.equal(HttpStatusCode.BAD_REQUEST_400)
  })

  it('Should accept a small last chunk', async function () {
    expect(run({ contentRange: 'bytes 4990-4999/5000' }).nextCalled).to.be.true

    // Whole file in a single small chunk
    expect(run({ contentRange: 'bytes 0-9/10' }).nextCalled).to.be.true
  })

  it('Should ignore requests without a chunk', async function () {
    // Upload status request
    expect(run({ contentRange: 'bytes */5000' }).nextCalled).to.be.true
    expect(run({ contentRange: undefined }).nextCalled).to.be.true
  })

  it('Should ignore a malformed content range, left to uploadx', async function () {
    expect(run({ contentRange: 'bytes 0-10' }).nextCalled).to.be.true
    expect(run({ contentRange: 'items 0-10/100' }).nextCalled).to.be.true
  })

  it('Should require bigger chunks for a big file, to not exceed the max number of object storage parts', async function () {
    const MiB = 1024 * 1024
    const total = 20_000 * MiB // At least 2MiB chunks

    const refused = run({ contentRange: `bytes 0-${MiB - 1}/${total}` })
    expect(refused.nextCalled).to.be.false
    expect(refused.failStatus).to.equal(HttpStatusCode.BAD_REQUEST_400)

    expect(run({ contentRange: `bytes 0-${2 * MiB - 1}/${total}` }).nextCalled).to.be.true
  })

  it('Should accept everything without a min chunk size', async function () {
    expect(run({ contentRange: 'bytes 0-9/5000', minChunkSize: 0 }).nextCalled).to.be.true
  })
})

// Test config: additional extensions and audio files are not allowed
describe('Resumable video upload file extension', function () {
  it('Should use the extension of the mimetype', function () {
    expect(buildVideoUploadFileExtension({ filename: 'video.mp4', mimetype: 'video/mp4' })).to.equal('.mp4')
    expect(buildVideoUploadFileExtension({ filename: 'video.webm', mimetype: 'video/mp4' })).to.equal('.mp4')

    // FFmpeg picks some demuxers from the extension
    expect(buildVideoUploadFileExtension({ filename: 'playlist.m3u8', mimetype: 'video/mp4' })).to.equal('.mp4')
  })

  it('Should use the extension of the filename if it is a video one and the mimetype is unknown', function () {
    expect(buildVideoUploadFileExtension({ filename: 'VIDEO.WEBM', mimetype: 'application/octet-stream' })).to.equal('.webm')
    expect(buildVideoUploadFileExtension({ filename: 'video.ogv', mimetype: 'unknown/type' })).to.equal('.ogv')
  })

  it('Should not use another extension', function () {
    expect(buildVideoUploadFileExtension({ filename: 'playlist.m3u8', mimetype: 'application/octet-stream' })).to.equal('')
    expect(buildVideoUploadFileExtension({ filename: 'manifest.mpd', mimetype: 'unknown/type' })).to.equal('')
    expect(buildVideoUploadFileExtension({ filename: 'video', mimetype: 'application/octet-stream' })).to.equal('')
  })
})
