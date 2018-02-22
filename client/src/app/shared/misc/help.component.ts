import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html'
})

export class HelpComponent implements OnInit {
  @Input() preHtml = ''
  @Input() postHtml = ''
  @Input() customHtml = ''
  @Input() helpType: 'custom' | 'markdownText' | 'markdownEnhanced' = 'custom'

  mainHtml = ''

  ngOnInit () {
    if (this.helpType === 'custom') {
      this.mainHtml = this.customHtml
      return
    }

    if (this.helpType === 'markdownText') {
      this.mainHtml = 'Markdown compatible.<br /><br />' +
        'Supports:' +
        '<ul>' +
        '<li>Links</li>' +
        '<li>Lists</li>' +
        '<li>Emphasis</li>' +
        '</ul>'
      return
    }

    if (this.helpType === 'markdownEnhanced') {
      this.mainHtml = 'Markdown compatible.<br /><br />' +
        'Supports:' +
        '<ul>' +
        '<li>Links</li>' +
        '<li>Lists</li>' +
        '<li>Emphasis</li>' +
        '<li>Images</li>' +
        '</ul>'
      return
    }
  }
}
