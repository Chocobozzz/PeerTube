import { first } from 'rxjs/operators'
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
import { CustomMarkupComponent } from './peertube-custom-tags/shared'

type AngularBuilderFunction = (el: HTMLElement) => ComponentRef<CustomMarkupComponent>
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
    this.customMarkdownRenderer = (text: string) => {
      return this.buildElement(text)
        .then(({ rootElement }) => rootElement)
    }
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

    const loadedPromises: Promise<boolean>[] = []

    for (const selector of Object.keys(this.angularBuilders)) {
      rootElement.querySelectorAll(selector)
        .forEach((e: HTMLElement) => {
          try {
            const component = this.execAngularBuilder(selector, e)

            if (component.instance.loaded) {
              const p = component.instance.loaded.pipe(first()).toPromise()
              loadedPromises.push(p)
            }

            this.dynamicElementService.injectElement(e, component)
          } catch (err) {
            console.error('Cannot inject component %s.', selector, err)
          }
        })
    }

    return { rootElement, componentsLoaded: Promise.all(loadedPromises) }
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

    const model = {
      name: data.name,
      displayLatestVideo: this.buildBoolean(data.displayLatestVideo) ?? true,
      displayDescription: this.buildBoolean(data.displayDescription) ?? true
    }

    this.dynamicElementService.setModel(component, model)

    return component
  }

  private buttonBuilder (el: HTMLElement) {
    const data = el.dataset as ButtonMarkupData
    const component = this.dynamicElementService.createElement(ButtonMarkupComponent)

    const model = {
      theme: data.theme ?? 'primary',
      href: data.href,
      label: data.label,
      blankTarget: this.buildBoolean(data.blankTarget) ?? false
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
      maxRows: this.buildNumber(data.maxRows) ?? -1,

      sort: data.sort || '-publishedAt',
      count: this.buildNumber(data.count) || 10,

      categoryOneOf: this.buildArrayNumber(data.categoryOneOf) ?? [],
      languageOneOf: this.buildArrayString(data.languageOneOf) ?? [],

      accountHandle: data.accountHandle || undefined,
      channelHandle: data.channelHandle || undefined,

      filter: this.buildBoolean(data.onlyLocal) ? 'local' as VideoFilter : undefined
    }

    this.dynamicElementService.setModel(component, model)

    return component
  }

  private containerBuilder (el: HTMLElement) {
    const data = el.dataset as ContainerMarkupData

    // Move inner HTML in the new element we'll create
    const content = el.innerHTML
    el.innerHTML = ''

    const root = document.createElement('div')
    root.innerHTML = content

    const layoutClass = data.layout
      ? 'layout-' + data.layout
      : 'layout-column'

    root.classList.add('peertube-container', layoutClass)

    if (data.width) {
      root.setAttribute('width', data.width)
    }

    if (data.title || data.description) {
      const headerElement = document.createElement('div')
      headerElement.classList.add('header')

      if (data.title) {
        const titleElement = document.createElement('h4')
        titleElement.innerText = data.title
        headerElement.appendChild(titleElement)
      }

      if (data.description) {
        const descriptionElement = document.createElement('div')
        descriptionElement.innerText = data.description
        headerElement.append(descriptionElement)
      }

      root.insertBefore(headerElement, root.firstChild)
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
