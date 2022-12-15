import { Transform, TransformCallback } from 'stream'

// Thanks: https://stackoverflow.com/a/45126242
class StreamReplacer extends Transform {
  private pendingChunk: Buffer

  constructor (private readonly replacer: (line: string) => string) {
    super()
  }

  _transform (chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    try {
      this.pendingChunk = this.pendingChunk?.length
        ? Buffer.concat([ this.pendingChunk, chunk ])
        : chunk

      let index: number

      // As long as we keep finding newlines, keep making slices of the buffer and push them to the
      // readable side of the transform stream
      while ((index = this.pendingChunk.indexOf('\n')) !== -1) {
        // The `end` parameter is non-inclusive, so increase it to include the newline we found
        const line = this.pendingChunk.slice(0, ++index)

        // `start` is inclusive, but we are already one char ahead of the newline -> all good
        this.pendingChunk = this.pendingChunk.slice(index)

        // We have a single line here! Prepend the string we want
        this.push(this.doReplace(line))
      }

      return done()
    } catch (err) {
      return done(err)
    }
  }

  _flush (done: TransformCallback) {
    // If we have any remaining data in the cache, send it out
    if (!this.pendingChunk?.length) return done()

    try {
      return done(null, this.doReplace(this.pendingChunk))
    } catch (err) {
      return done(err)
    }
  }

  private doReplace (buffer: Buffer) {
    const line = this.replacer(buffer.toString('utf8'))

    return Buffer.from(line, 'utf8')
  }
}

export {
  StreamReplacer
}
