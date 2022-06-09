import { Injectable } from '@angular/core'
import { Meta, Title } from '@angular/platform-browser'
import { HTMLServerConfig } from '@shared/models/server'
import { ServerService } from '../server'

export interface MetaSettings {
  title?: string
}

@Injectable()
export class MetaService {
  private config: HTMLServerConfig

  constructor (
    private titleService: Title,
    private meta: Meta,
    private server: ServerService
  ) {
    this.config = this.server.getHTMLConfig()
  }

  setTitle (subTitle?: string) {
    let title = ''
    if (subTitle) title += `${subTitle} - `

    title += this.config.instance.name

    this.titleService.setTitle(title)
  }

  setTag (name: string, value: string) {
    this.meta.addTag({ name, content: value })
  }

  update (meta: MetaSettings) {
    this.setTitle(meta.title)
  }
}
