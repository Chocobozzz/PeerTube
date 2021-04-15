
import { ComponentRef, Injectable } from '@angular/core'
import { MarkdownService } from '@app/core'
import { EmbedMarkupData, PlaylistMiniatureMarkupData, VideoMiniatureMarkupData } from '@shared/models'
import { ButtonComponent, DateToggleComponent } from '../shared-main'
import { DynamicElementService } from './dynamic-element.service'
import { EmbedMarkupComponent } from './embed-markup.component'
import { PlaylistMiniatureMarkupComponent } from './playlist-miniature-markup.component'
import { VideoMiniatureMarkupComponent } from './video-miniature-markup.component'

type BuilderFunction = (el: HTMLElement) => ComponentRef<any>

@Injectable()
export class CustomMarkupService {
  private builders: { [ selector: string ]: BuilderFunction } = {
    'peertube-button': el => this.buttonBuilder(el),
    'peertube-date': el => this.dateBuilder(el),
    'peertube-video-embed': el => this.embedBuilder(el, 'video'),
    'peertube-playlist-embed': el => this.embedBuilder(el, 'playlist'),
    'peertube-video-miniature': el => this.videoMiniatureBuilder(el),
    'peertube-playlist-miniature': el => this.playlistMiniatureBuilder(el)
  }

  constructor (
    private dynamicElementService: DynamicElementService,
    private markdown: MarkdownService
  ) { }

  async buildElement (text: string) {
    const html = await this.markdown.customMarkupMarkdownToHTML(text, this.getSupportedTags())

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

  private buttonBuilder (_el: HTMLElement) {
    const component = this.dynamicElementService.createElement(ButtonComponent)

    this.dynamicElementService.setModel(component, { loading: true, label: 'toto' })

    return component
  }

  private dateBuilder (_el: HTMLElement) {
    const component = this.dynamicElementService.createElement(DateToggleComponent)

    this.dynamicElementService.setModel(component, { date: new Date() })

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
}
