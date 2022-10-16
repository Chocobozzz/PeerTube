class YoutubeDLError extends Error {
  status: YoutubeDLError.STATUS
  url?: string
  cause?: Error // TODO: Property to remove once ES2022 is used

  constructor ({ status, url }) {
    super(YoutubeDLError.reasonFromStatus(status, url))
    this.status = status
    this.url = url
  }

  static reasonFromStatus (status: YoutubeDLError.STATUS, url: string): string {
    switch (status) {
      case YoutubeDLError.STATUS.IS_LIVE:
        return `Video ${url} is currently livestreaming`
      case YoutubeDLError.STATUS.TO_BE_PUBLISHED:
        return `Video ${url} has not been published yet`
      case YoutubeDLError.STATUS.NOT_POST_PROCESSED:
        return `Video ${url} is currently post processing`
      case YoutubeDLError.STATUS.NO_FORMATS_AVAILABLE:
        return `Video ${url} has no downloadable video formats available`
      case YoutubeDLError.STATUS.VIDEO_AVAILABILITY_ERROR:
        return `Video ${url} not available for import`
    }
  }

  static fromError (err: Error, status: YoutubeDLError.STATUS, url: string) {
    const ytDlErr = new this({ url, status })
    ytDlErr.cause = err
    ytDlErr.stack = err.stack // TODO: Useless once ES2022 is used
    return ytDlErr
  }
}

namespace YoutubeDLError {
  export enum STATUS {
    VIDEO_AVAILABILITY_ERROR,
    NO_FORMATS_AVAILABLE,
    NOT_POST_PROCESSED,
    IS_LIVE,
    TO_BE_PUBLISHED
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLError
}
