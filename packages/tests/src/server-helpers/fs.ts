/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { isFileInsideDirectory } from '@peertube/peertube-server/core/helpers/fs.js'
import { expect } from 'chai'

describe('FS helpers', function () {
  it('Should accept a file inside the directory', function () {
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp/file.mp4', '/var/www/peertube/storage/tmp')).to.be.true
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp/file.mp4', '/var/www/peertube/storage/tmp/')).to.be.true
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp/sub/file.mp4', '/var/www/peertube/storage/tmp')).to.be.true
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp/..file.mp4', '/var/www/peertube/storage/tmp')).to.be.true
  })

  it('Should refuse a file outside of the directory', function () {
    expect(isFileInsideDirectory('/var/www/peertube/storage', '/var/www/peertube/storage/tmp')).to.be.false
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp', '/var/www/peertube/storage/tmp')).to.be.false
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp-other/file.mp4', '/var/www/peertube/storage/tmp')).to.be.false
    expect(isFileInsideDirectory('/var/www/peertube/storage/tmp/../videos/file.mp4', '/var/www/peertube/storage/tmp')).to.be.false
    expect(isFileInsideDirectory('/etc/passwd', '/var/www/peertube/storage/tmp')).to.be.false
    expect(isFileInsideDirectory('relative/file.mp4', '/var/www/peertube/storage/tmp')).to.be.false
  })
})
