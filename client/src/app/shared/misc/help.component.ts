import { Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/videos/shared'
import { TooltipDirective } from 'ngx-bootstrap/tooltip'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html'
})

export class HelpComponent implements OnInit {
  @ViewChild('tooltipDirective') tooltipDirective: TooltipDirective
  @Input() preHtml = ''
  @Input() postHtml = ''
  @Input() customHtml = ''
  @Input() helpType: 'custom' | 'markdownText' | 'markdownEnhanced' = 'custom'

  mainHtml = ''

  constructor (private elementRef: ElementRef) { }

  ngOnInit () {
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

  @HostListener('document:click', ['$event.target'])
  public onClick (targetElement) {
    const clickedInside = this.elementRef.nativeElement.contains(targetElement)

    if (this.tooltipDirective.isOpen && !clickedInside) {
      this.tooltipDirective.hide()
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    return '<a href="https://en.wikipedia.org/wiki/Markdown#Example" target="_blank">Markdown</a> compatible that supports:' +
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
