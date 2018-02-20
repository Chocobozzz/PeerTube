import { Injectable } from '@angular/core'

import * as MarkdownIt from 'markdown-it'

@Injectable()
export class MarkdownService {
  private textMarkdownIt: MarkdownIt.MarkdownIt
  private linkifier: MarkdownIt.MarkdownIt
  private enhancedMarkdownIt: MarkdownIt.MarkdownIt

  constructor () {
    this.textMarkdownIt = new MarkdownIt('zero', { linkify: true, breaks: true })
      .enable('linkify')
      .enable('autolink')
      .enable('emphasis')
      .enable('link')
      .enable('newline')
      .enable('list')
    this.setTargetToLinks(this.textMarkdownIt)

    this.enhancedMarkdownIt = new MarkdownIt('zero', { linkify: true, breaks: true })
      .enable('linkify')
      .enable('autolink')
      .enable('emphasis')
      .enable('link')
      .enable('newline')
      .enable('list')
      .enable('image')
    this.setTargetToLinks(this.enhancedMarkdownIt)

    this.linkifier = new MarkdownIt('zero', { linkify: true })
      .enable('linkify')
    this.setTargetToLinks(this.linkifier)
  }

  textMarkdownToHTML (markdown: string) {
    const html = this.textMarkdownIt.render(markdown)

    return this.avoidTruncatedLinks(html)
  }

  enhancedMarkdownToHTML (markdown: string) {
    const html = this.enhancedMarkdownIt.render(markdown)

    return this.avoidTruncatedLinks(html)
  }

  linkify (text: string) {
    const html = this.linkifier.render(text)

    return this.avoidTruncatedLinks(html)
  }

  private setTargetToLinks (markdownIt: MarkdownIt.MarkdownIt) {
    // Snippet from markdown-it documentation: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    const defaultRender = markdownIt.renderer.rules.link_open || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options)
    }

    markdownIt.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      // If you are sure other plugins can't add `target` - drop check below
      const aIndex = tokens[idx].attrIndex('target')

      if (aIndex < 0) {
        tokens[idx].attrPush(['target', '_blank']) // add new attribute
      } else {
        tokens[idx].attrs[aIndex][1] = '_blank'    // replace value of existing attr
      }

      // pass token to default renderer.
      return defaultRender(tokens, idx, options, env, self)
    }
  }

  private avoidTruncatedLinks (html) {
    return html.replace(/<a[^>]+>([^<]+)<\/a>\s*...(<\/p>)?$/mi, '$1...')
  }
}
