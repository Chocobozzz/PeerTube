import { Injectable } from '@angular/core'

import * as MarkdownIt from 'markdown-it'

@Injectable()
export class MarkdownService {
  static TEXT_RULES = [
    'linkify',
    'autolink',
    'emphasis',
    'link',
    'newline',
    'list'
  ]
  static ENHANCED_RULES = MarkdownService.TEXT_RULES.concat([ 'image' ])

  private textMarkdownIt: MarkdownIt.MarkdownIt
  private enhancedMarkdownIt: MarkdownIt.MarkdownIt

  constructor () {
    this.textMarkdownIt = this.createMarkdownIt(MarkdownService.TEXT_RULES)
    this.enhancedMarkdownIt = this.createMarkdownIt(MarkdownService.ENHANCED_RULES)
  }

  textMarkdownToHTML (markdown: string) {
    const html = this.textMarkdownIt.render(markdown)

    return this.avoidTruncatedLinks(html)
  }

  enhancedMarkdownToHTML (markdown: string) {
    const html = this.enhancedMarkdownIt.render(markdown)

    return this.avoidTruncatedLinks(html)
  }

  private createMarkdownIt (rules: string[]) {
    const markdownIt = new MarkdownIt('zero', { linkify: true, breaks: true })

    for (let rule of rules) {
      markdownIt.enable(rule)
    }

    this.setTargetToLinks(markdownIt)

    return markdownIt
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
