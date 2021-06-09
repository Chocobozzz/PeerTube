import { ComponentRef, Injectable } from '@angular/core'
import { MarkdownService } from '@app/core'
import {
  ButtonMarkupData,
  ChannelMiniatureMarkupData,
  ContainerMarkupData,
  EmbedMarkupData,
  PlaylistMiniatureMarkupData,
  VideoFilter,
  VideoMiniatureMarkupData,
  VideosListMarkupData
} from '@shared/models'
import { DynamicElementService } from './dynamic-element.service'
import {
  ButtonMarkupComponent,
  ChannelMiniatureMarkupComponent,
  EmbedMarkupComponent,
  PlaylistMiniatureMarkupComponent,
  VideoMiniatureMarkupComponent,
  VideosListMarkupComponent
} from './peertube-custom-tags'

type AngularBuilderFunction = (el: HTMLElement) => ComponentRef<any>
type HTMLBuilderFunction = (el: HTMLElement) => HTMLElement

@Injectable()
export class CustomMarkupService {
  private angularBuilders: { [ selector: string ]: AngularBuilderFunction } = {
    'peertube-button': el => this.buttonBuilder(el),
    'peertube-video-embed': el => this.embedBuilder(el, 'video'),
    'peertube-playlist-embed': el => this.embedBuilder(el, 'playlist'),
    'peertube-video-miniature': el => this.videoMiniatureBuilder(el),
    'peertube-playlist-miniature': el => this.playlistMiniatureBuilder(el),
    'peertube-channel-miniature': el => this.channelMiniatureBuilder(el),
    'peertube-videos-list': el => this.videosListBuilder(el)
  }

  private htmlBuilders: { [ selector: string ]: HTMLBuilderFunction } = {
    'peertube-container': el => this.containerBuilder(el)
  }

  private customMarkdownRenderer: (text: string) => Promise<HTMLElement>

  constructor (
    private dynamicElementService: DynamicElementService,
    private markdown: MarkdownService
  ) {
    this.customMarkdownRenderer = async (text: string) => this.buildElement(text)
  }

  getCustomMarkdownRenderer () {
    return this.customMarkdownRenderer
  }

  async buildElement (text: string) {
    const html = await this.markdown.customPageMarkdownToHTML(text, this.getSupportedTags())

    const rootElement = document.createElement('div')
    rootElement.innerHTML = html

    for (const selector of Object.keys(this.htmlBuilders)) {
      rootElement.querySelectorAll(selector)
        .forEach((e: HTMLElement) => {
          try {
            const element = this.execHTMLBuilder(selector, e)
            // Insert as first child
            e.insertBefore(element, e.firstChild)
          } catch (err) {
            console.error('Cannot inject component %s.', selector, err)
          }
        })
    }

    for (const selector of Object.keys(this.angularBuilders)) {
      rootElement.querySelectorAll(selector)
        .forEach((e: HTMLElement) => {
          try {
            const component = this.execAngularBuilder(selector, e)

            this.dynamicElementService.injectElement(e, component)
          } catch (err) {
            console.error('Cannot inject component %s.', selector, err)
          }
        })
    }

    return rootElement
  }

  private getSupportedTags () {
    return Object.keys(this.angularBuilders)
      .concat(Object.keys(this.htmlBuilders))
  }

  private execHTMLBuilder (selector: string, el: HTMLElement) {
    return this.htmlBuilders[selector](el)
  }

  private execAngularBuilder (selector: string, el: HTMLElement) {
    return this.angularBuilders[selector](el)
  }

  private embedBuilder (el: HTMLElement, type: 'video' | 'playlist') {
    const data = el.dataset as EmbedMarkupData
    const component = this.dynamicElementService.createElement(EmbedMarkupComponent)

    this.dynamicElementService.setModel(component, { uuid: data.uuid, type })

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

  private videoMiniatureBuilder (el: HTMLElement) {
    const data = el.dataset as VideoMiniatureMarkupData
    const component = this.dynamicElementService.createElement(VideoMiniatureMarkupComponent)

    const model = {
      uuid: data.uuid,
      onlyDisplayTitle: this.buildBoolean(data.onlyDisplayTitle) ?? false
    }

    this.dynamicElementService.setModel(component, model)

    return component
  }

  private videosListBuilder (el: HTMLElement) {
    const data = el.dataset as VideosListMarkupData
    const component = this.dynamicElementService.createElement(VideosListMarkupComponent)

    const model = {
      onlyDisplayTitle: this.buildBoolean(data.onlyDisplayTitle) ?? false,
      sort: data.sort || '-publishedAt',
      categoryOneOf: this.buildArrayNumber(data.categoryOneOf) ?? [],
      languageOneOf: this.buildArrayString(data.languageOneOf) ?? [],
      filter: this.buildBoolean(data.onlyLocal) ? 'local' as VideoFilter : undefined,
      count: this.buildNumber(data.count) || 10
    }

    this.dynamicElementService.setModel(component, model)

    return component
  }

  private containerBuilder (el: HTMLElement) {
    const data = el.dataset as ContainerMarkupData

    const root = document.createElement('div')
    root.classList.add('peertube-container')

    if (data.width) {
      root.setAttribute('width', data.width)
    }

    if (data.title) {
      const titleElement = document.createElement('h4')
      titleElement.innerText = data.title
      root.appendChild(titleElement)
    }

    if (data.description) {
      const descriptionElement = document.createElement('div')
      descriptionElement.innerText = data.description
      root.appendChild(descriptionElement)
    }

    return root
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
