/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildCopySource, isObjectNotFoundError } from '@peertube/peertube-server/core/lib/object-storage/object-storage-helpers.js'
import { expect } from 'chai'

describe('Object storage helpers', function () {
  it('Should build a copy source', function () {
    expect(buildCopySource('bucket', 'prefix/key.mp4')).to.equal('bucket/prefix/key.mp4')
  })

  it('Should encode each segment of a copy source but keep the slashes', function () {
    expect(buildCopySource('bucket', 'staging/resumable-uploads/1-a+b?c#d &e.mp4'))
      .to.equal('bucket/staging/resumable-uploads/1-a%2Bb%3Fc%23d%20%26e.mp4')

    expect(buildCopySource('bucket', 'vidéo.mp4')).to.equal('bucket/vid%C3%A9o.mp4')
  })

  it('Should detect a missing object', function () {
    expect(isObjectNotFoundError({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } })).to.be.true
    expect(isObjectNotFoundError({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })).to.be.true
    expect(isObjectNotFoundError({ name: 'Unknown', $metadata: { httpStatusCode: 404 } })).to.be.true
  })

  it('Should not consider a missing bucket or another error as a missing object', function () {
    expect(isObjectNotFoundError({ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } })).to.be.false
    expect(isObjectNotFoundError({ name: 'Unknown', Code: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } })).to.be.false
    expect(isObjectNotFoundError({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).to.be.false
    expect(isObjectNotFoundError(undefined)).to.be.false
  })
})
