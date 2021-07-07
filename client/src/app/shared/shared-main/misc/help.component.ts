import { AfterContentInit, Component, ContentChildren, Input, OnChanges, OnInit, QueryList, TemplateRef } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { ENHANCED_RULES, TEXT_RULES } from '@shared/core-utils/renderer/markdown'
import { PeerTubeTemplateDirective } from '../angular'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html'
})

export class HelpComponent implements OnInit, OnChanges, AfterContentInit {
  @Input() helpType: 'custom' | 'markdownText' | 'markdownEnhanced' = 'custom'
  @Input() tooltipPlacement = 'right auto'
  @Input() iconName: GlobalIconName = 'help'
  @Input() title = $localize`Get help`
  @Input() autoClose = 'outside'

  @ContentChildren(PeerTubeTemplateDirective) templates: QueryList<PeerTubeTemplateDirective<'preHtml' | 'customHtml' | 'postHtml'>>

  isPopoverOpened = false
  mainHtml = ''

  preHtmlTemplate: TemplateRef<any>
  customHtmlTemplate: TemplateRef<any>
  postHtmlTemplate: TemplateRef<any>

  ngOnInit () {
    this.init()
  }

  ngAfterContentInit () {
    {
      const t = this.templates.find(t => t.name === 'preHtml')
      if (t) this.preHtmlTemplate = t.template
    }

    {
      const t = this.templates.find(t => t.name === 'customHtml')
      if (t) this.customHtmlTemplate = t.template
    }

    {
      const t = this.templates.find(t => t.name === 'postHtml')
      if (t) this.postHtmlTemplate = t.template
    }
  }

  ngOnChanges () {
    this.init()
  }

  onPopoverHidden () {
    this.isPopoverOpened = false
  }

  onPopoverShown () {
    this.isPopoverOpened = true
  }

  private init () {
    if (this.helpType === 'markdownText') {
      this.mainHtml = this.formatMarkdownSupport(TEXT_RULES)
      return
    }

    if (this.helpType === 'markdownEnhanced') {
      this.mainHtml = this.formatMarkdownSupport(ENHANCED_RULES)
      return
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    // tslint:disable:max-line-length
    return $localize`<a href="https://en.wikipedia.org/wiki/Markdown#Example" target="_blank" rel="noopener noreferrer">Markdown</a> compatible that supports:` +
      this.createMarkdownList(rules)
  }

  private createMarkdownList (rules: string[]) {
    const rulesToText = {
      'emphasis': $localize`Emphasis`,
      'link': $localize`Links`,
      'newline': $localize`New lines`,
      'list': $localize`Lists`,
      'image': $localize`Images`
    }

    const bullets = rules.map(r => rulesToText[r])
      .filter(text => text)
      .map(text => '<li>' + text + '</li>')
      .join('')

    return '<ul>' + bullets + '</ul>'
  }
}
