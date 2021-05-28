import { ComponentRef, Injectable } from '@angular/core'
import { MarkdownService } from '@app/core'
import {
  ButtonMarkupData,
  ChannelMiniatureMarkupData,
  EmbedMarkupData,
  PlaylistMiniatureMarkupData,
  VideoMiniatureMarkupData,
  VideosListMarkupData
} from '@shared/models'
import { ButtonMarkupComponent } from './button-markup.component'
import { ChannelMiniatureMarkupComponent } from './channel-miniature-markup.component'
import { DynamicElementService } from './dynamic-element.service'
import { EmbedMarkupComponent } from './embed-markup.component'
import { PlaylistMiniatureMarkupComponent } from './playlist-miniature-markup.component'
import { VideoMiniatureMarkupComponent } from './video-miniature-markup.component'
import { VideosListMarkupComponent } from './videos-list-markup.component'

type BuilderFunction = (el: HTMLElement) => ComponentRef<any>

@Injectable()
export class CustomMarkupService {
  private builders: { [ selector: string ]: BuilderFunction } = {
    'peertube-button': el => this.buttonBuilder(el),
    'peertube-video-embed': el => this.embedBuilder(el, 'video'),
    'peertube-playlist-embed': el => this.embedBuilder(el, 'playlist'),
    'peertube-video-miniature': el => this.videoMiniatureBuilder(el),
    'peertube-playlist-miniature': el => this.playlistMiniatureBuilder(el),
    'peertube-channel-miniature': el => this.channelMiniatureBuilder(el),
    'peertube-videos-list': el => this.videosListBuilder(el)
  }

  constructor (
    private dynamicElementService: DynamicElementService,
    private markdown: MarkdownService
  ) { }

  async buildElement (text: string) {
    const html = await this.markdown.customPageMarkdownToHTML(text, this.getSupportedTags())

    const rootElement = document.createElement('div')
    rootElement.innerHTML = html

    for (const selector of this.getSupportedTags()) {
      rootElement.querySelectorAll(selector)
        .forEach((e: HTMLElement) => {
          try {
            const component = this.execBuilder(selector, e)

            this.dynamicElementService.injectElement(e, component)
          } catch (err) {
            console.error('Cannot inject component %s.', selector, err)
          }
        })
    }

    return rootElement
  }

  private getSupportedTags () {
    return Object.keys(this.builders)
  }

  private execBuilder (selector: string, el: HTMLElement) {
    return this.builders[selector](el)
  }

  private embedBuilder (el: HTMLElement, type: 'video' | 'playlist') {
    const data = el.dataset as EmbedMarkupData
    const component = this.dynamicElementService.createElement(EmbedMarkupComponent)

    this.dynamicElementService.setModel(component, { uuid: data.uuid, type })

    return component
  }

  private videoMiniatureBuilder (el: HTMLElement) {
    const data = el.dataset as VideoMiniatureMarkupData
    const component = this.dynamicElementService.createElement(VideoMiniatureMarkupComponent)

    this.dynamicElementService.setModel(component, { uuid: data.uuid })

    return component
  }

  private playlistMiniatureBuilder (el: HTMLElement) {
    const data = el.dataset as PlaylistMiniatureMarkupData
    const component = this.dynamicElementService.createElement(PlaylistMiniatureMarkupComponent)

    this.dynamicElementService.setModel(component, { uuid: data.uuid })

    return component
  }

  private channelMiniatureBuilder (el: HTMLElement) {
    const data = el.dataset as ChannelMiniatureMarkupData
    const component = this.dynamicElementService.createElement(ChannelMiniatureMarkupComponent)

    this.dynamicElementService.setModel(component, { name: data.name })

    return component
  }

  private buttonBuilder (el: HTMLElement) {
    const data = el.dataset as ButtonMarkupData
    const component = this.dynamicElementService.createElement(ButtonMarkupComponent)

    const model = {
      theme: data.theme,
      href: data.href,
      label: data.label,
      blankTarget: this.buildBoolean(data.blankTarget)
    }
    this.dynamicElementService.setModel(component, model)

    return component
  }

  private videosListBuilder (el: HTMLElement) {
    const data = el.dataset as VideosListMarkupData
    const component = this.dynamicElementService.createElement(VideosListMarkupComponent)

    const model = {
      title: data.title,
      description: data.description,
      sort: data.sort,
      categoryOneOf: this.buildArrayNumber(data.categoryOneOf),
      languageOneOf: this.buildArrayString(data.languageOneOf),
      count: this.buildNumber(data.count) || 10
    }

    this.dynamicElementService.setModel(component, model)

    return component
  }

  private buildNumber (value: string) {
    if (!value) return undefined

    return parseInt(value, 10)
  }

  private buildBoolean (value: string) {
    if (value === 'true') return true
    if (value === 'false') return false

    return undefined
  }

  private buildArrayNumber (value: string) {
    if (!value) return undefined

    return value.split(',').map(v => parseInt(v, 10))
  }

  private buildArrayString (value: string) {
    if (!value) return undefined

    return value.split(',')
  }
}
