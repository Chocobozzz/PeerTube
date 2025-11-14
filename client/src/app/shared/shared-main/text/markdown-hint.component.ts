import { booleanAttribute, Component, input, OnChanges, OnInit } from '@angular/core'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { ENHANCED_RULES, TEXT_RULES } from '@peertube/peertube-core-utils'

@Component({
  selector: 'my-markdown-hint',
  styleUrls: [ './markdown-hint.component.scss' ],
  templateUrl: './markdown-hint.component.html',
  imports: [ NgbPopover ]
})
export class MarkdownHintComponent implements OnInit, OnChanges {
  readonly helpType = input.required<'markdownText' | 'markdownEnhanced'>()
  readonly supportRelMe = input(false, { transform: booleanAttribute })

  markdownRules: string[] = []

  ngOnInit () {
    this.init()
  }

  ngOnChanges () {
    this.init()
  }

  private init () {
    const helpType = this.helpType()
    if (helpType === 'markdownText') {
      this.markdownRules = this.createMarkdownList(TEXT_RULES)
      return
    }

    if (helpType === 'markdownEnhanced') {
      this.markdownRules = this.createMarkdownList(ENHANCED_RULES)
      return
    }
  }

  createMarkdownList (rules: string[]) {
    const rulesToText: { [id: string]: string } = {
      emphasis: $localize`Emphasis: *text*`,
      link: $localize`Links: [title](https://example.com)`,
      newline: $localize`New lines`,
      list: $localize`Lists`,
      image: $localize`Images: ![description](https://example.com/image.png)`
    }

    return rules.map(r => rulesToText[r]).filter(text => !!text)
  }
}
