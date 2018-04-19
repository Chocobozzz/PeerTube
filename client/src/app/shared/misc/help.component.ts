import { Component, Input, OnChanges, OnInit } from '@angular/core'
import { MarkdownService } from '@app/videos/shared'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html'
})

export class HelpComponent implements OnInit, OnChanges {
  @Input() preHtml = ''
  @Input() postHtml = ''
  @Input() customHtml = ''
  @Input() helpType: 'custom' | 'markdownText' | 'markdownEnhanced' = 'custom'
  @Input() tooltipPlacement = 'right'

  mainHtml = ''

  ngOnInit () {
    this.init()
  }

  ngOnChanges () {
    this.init()
  }

  private init () {
    if (this.helpType === 'custom') {
      this.mainHtml = this.customHtml
      return
    }

    if (this.helpType === 'markdownText') {
      this.mainHtml = this.formatMarkdownSupport(MarkdownService.TEXT_RULES)
      return
    }

    if (this.helpType === 'markdownEnhanced') {
      this.mainHtml = this.formatMarkdownSupport(MarkdownService.ENHANCED_RULES)
      return
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    return '<a href="https://en.wikipedia.org/wiki/Markdown#Example" target="_blank" rel="noopener noreferrer">Markdown</a> ' +
      'compatible that supports:' +
      this.createMarkdownList(rules)
  }

  private createMarkdownList (rules: string[]) {
    const rulesToText = {
      'emphasis': 'Emphasis',
      'link': 'Links',
      'newline': 'New lines',
      'list': 'Lists',
      'image': 'Images'
    }

    const bullets = rules.map(r => rulesToText[r])
      .filter(text => text)
      .map(text => '<li>' + text + '</li>')
      .join('')

    return '<ul>' + bullets + '</ul>'
  }
}
