import { YoutubeDLBaseBuilder } from './youtube-dl-base-builder'
import { YoutubeDLInfo } from './youtube-dl-info-builder'
import { YoutubeDLCLIResult } from './youtube-dl-cli'

class YoutubeDLListBuilder extends YoutubeDLBaseBuilder {
  private readonly list: any[]

  constructor (list: any[]) {
    super()
    this.list = [ ...list ]
  }

  getList (): Partial<YoutubeDLInfo>[] {
    return this.buildList(this.normalizeList(this.list))
  }

  private normalizeList (entries: any[]) {
    return entries.map((item) => {
      return this.normalizeObject(item)
    })
  }

  private buildList (entries: Partial<YoutubeDLCLIResult>[]): Partial<YoutubeDLInfo>[] {
    return entries.map((item) => {
      const info: Partial<YoutubeDLInfo> = {
        webpageUrl: item.webpage_url
      }

      return info
    })
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLListBuilder
}
