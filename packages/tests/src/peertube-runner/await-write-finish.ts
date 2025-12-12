/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { watch } from 'chokidar'
import { ensureDir, remove } from 'fs-extra/esm'
import { appendFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildUUID } from '@peertube/peertube-node-utils'
import { wait } from '@peertube/peertube-core-utils'

/**
 * Test for awaitWriteFinish configuration in file watcher.
 *
 * This test verifies the fix for issue #7328:
 * Without awaitWriteFinish, chokidar triggers 'add' events immediately when a file
 * is created, even if it's still being written. This caused HTTP 416 errors during
 * live streaming because incomplete .ts segments were uploaded to the server.
 *
 * With awaitWriteFinish, chokidar waits for the file size to stabilize before
 * triggering the event, ensuring complete files are processed.
 */
describe('Test awaitWriteFinish file watcher behavior', function () {
  let testDir: string
  let watcher: ReturnType<typeof watch>

  beforeEach(async function () {
    // Use unique directory for each test to avoid cross-test interference
    testDir = join(tmpdir(), 'peertube-test-' + buildUUID())
    await ensureDir(testDir)
  })

  afterEach(async function () {
    if (watcher) {
      await watcher.close()
      watcher = undefined
    }
    await remove(testDir)
  })

  it('Should wait for file to be fully written before triggering add event', async function () {
    this.timeout(10000)

    const events: { event: string, path: string, time: number }[] = []
    const startTime = Date.now()
    const testFile = join(testDir, 'test-segment.ts')

    // Create watcher with awaitWriteFinish (same config as in process-live.ts)
    watcher = watch(testDir, {
      ignored: (path: string) => path !== testDir && !path.endsWith('.ts'),
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    })

    watcher.on('add', (path) => {
      events.push({ event: 'add', path, time: Date.now() - startTime })
    })

    // Wait for watcher to be ready
    await new Promise<void>(resolve => watcher.on('ready', resolve))

    // Simulate slow file write (like FFmpeg writing a segment)
    await writeFile(testFile, 'chunk1')
    await wait(100)
    await appendFile(testFile, 'chunk2')
    await wait(100)
    await appendFile(testFile, 'chunk3')

    const writeEndTime = Date.now() - startTime

    // Wait for awaitWriteFinish to detect stability (500ms + buffer)
    await wait(800)

    // Verify: event should have fired AFTER writes completed + stability threshold
    expect(events).to.have.lengthOf(1)
    expect(events[0].event).to.equal('add')
    expect(events[0].path).to.equal(testFile)

    // The event should fire after stability threshold (500ms) from last write
    // Last write was at ~200ms, so event should be around 700ms+
    expect(events[0].time).to.be.greaterThan(writeEndTime + 400)
  })

  it('Should trigger immediately without awaitWriteFinish', async function () {
    this.timeout(5000)

    if (watcher) await watcher.close()

    const events: { event: string, path: string, time: number }[] = []
    const startTime = Date.now()
    const testFile = join(testDir, 'test-immediate.ts')

    // Create watcher WITHOUT awaitWriteFinish (old behavior)
    watcher = watch(testDir, {
      ignored: (path: string) => path !== testDir && !path.endsWith('.ts')
      // No awaitWriteFinish - triggers immediately
    })

    watcher.on('add', (path) => {
      events.push({ event: 'add', path, time: Date.now() - startTime })
    })

    await new Promise<void>(resolve => watcher.on('ready', resolve))

    // Write file
    await writeFile(testFile, 'chunk1')

    // Give a small window for the event
    await wait(200)

    // Verify: event should have fired almost immediately (< 200ms)
    expect(events).to.have.lengthOf(1)
    expect(events[0].time).to.be.lessThan(200)
  })
})
