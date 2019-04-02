import { Injectable } from '@angular/core'

import { MarkdownIt } from 'markdown-it'

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

  private textMarkdownIt: MarkdownIt
  private enhancedMarkdownIt: MarkdownIt

  async textMarkdownToHTML (markdown: string) {
    if (!markdown) return ''

    if (!this.textMarkdownIt) {
      this.textMarkdownIt = await this.createMarkdownIt(MarkdownService.TEXT_RULES)
    }

    const html = this.textMarkdownIt.render(markdown)
    return this.avoidTruncatedTags(html)
  }

  async enhancedMarkdownToHTML (markdown: string) {
    if (!markdown) return ''

    if (!this.enhancedMarkdownIt) {
      this.enhancedMarkdownIt = await this.createMarkdownIt(MarkdownService.ENHANCED_RULES)
    }

    const html = this.enhancedMarkdownIt.render(markdown)
    return this.avoidTruncatedTags(html)
  }

  private async createMarkdownIt (rules: string[]) {
    // FIXME: import('..') returns a struct module, containing a "default" field corresponding to our sanitizeHtml function
    const MarkdownItClass: typeof import ('markdown-it') = (await import('markdown-it') as any).default

    const markdownIt = new MarkdownItClass('zero', { linkify: true, breaks: true })

    for (const rule of rules) {
      markdownIt.enable(rule)
    }

    this.setTargetToLinks(markdownIt)

    return markdownIt
  }

  private setTargetToLinks (markdownIt: MarkdownIt) {
    // Snippet from markdown-it documentation: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    const defaultRender = markdownIt.renderer.rules.link_open || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options)
    }

    markdownIt.renderer.rules.link_open = function (tokens, index, options, env, self) {
      const token = tokens[index]

      const targetIndex = token.attrIndex('target')
      if (targetIndex < 0) token.attrPush([ 'target', '_blank' ])
      else token.attrs[targetIndex][1] = '_blank'

      const relIndex = token.attrIndex('rel')
      if (relIndex < 0) token.attrPush([ 'rel', 'noopener noreferrer' ])
      else token.attrs[relIndex][1] = 'noopener noreferrer'

      // pass token to default renderer.
      return defaultRender(tokens, index, options, env, self)
    }
  }

  private avoidTruncatedTags (html: string) {
    return html.replace(/\*\*?([^*]+)$/, '$1')
      .replace(/<a[^>]+>([^<]+)<\/a>\s*...((<\/p>)|(<\/li>)|(<\/strong>))?$/mi, '$1...')
      .replace(/\[[^\]]+\]?\(?([^\)]+)$/, '$1')

  }
}
