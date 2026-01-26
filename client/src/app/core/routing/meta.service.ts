import { Injectable, inject } from '@angular/core'
import { Meta, Title } from '@angular/platform-browser'
import { getOriginUrl } from '@app/helpers'
import { getInstanceRSSFeed } from '@peertube/peertube-core-utils'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { ServerService } from '../server'

export interface MetaSettings {
  title?: string
}

@Injectable()
export class MetaService {
  private titleService = inject(Title)
  private meta = inject(Meta)
  private server = inject(ServerService)

  private config: HTMLServerConfig

  constructor () {
    this.config = this.server.getHTMLConfig()
  }

  update (meta: MetaSettings) {
    this.setTitle(meta.title)
  }

  setTitle (subTitle?: string) {
    let title = ''
    if (subTitle) title += `${subTitle} - `

    title += this.config.instance.name

    this.titleService.setTitle(title)
  }

  setDescription (description?: string) {
    this.meta.updateTag({ name: 'description', content: description || this.config.instance.shortDescription })
  }

  revertMetaTags () {
    this.setTitle()
    this.setDescription()

    this.setRSSFeeds([
      getInstanceRSSFeed({
        url: getOriginUrl(),
        title: `${this.config.instance.name} - Videos feed`
      })
    ])
  }

  setRSSFeeds (rssFeeds: { title: string, url: string }[]) {
    const head = document.getElementsByTagName('head')[0]

    head.querySelectorAll('link[rel="alternate"]').forEach(el => head.removeChild(el))

    for (const rssFeed of rssFeeds) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.type = 'application/rss+xml'
      link.title = rssFeed.title
      link.href = rssFeed.url

      head.appendChild(link)
    }
  }
}
