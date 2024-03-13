import { Component, Input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { NgIf, NgClass, NgTemplateOutlet } from '@angular/common'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html',
  standalone: true,
  imports: [ NgIf, RouterLink, NgClass, NgTemplateOutlet ]
})
export class LinkComponent implements OnInit {
  @Input() internalLink?: string | any[]

  @Input() href?: string
  @Input() target = '_self'

  @Input() title?: string

  @Input() className?: string
  @Input() inheritParentCSS = false

  @Input() tabindex: string | number

  @Input() ariaLabel: string

  builtClasses: string

  ngOnInit () {
    this.builtClasses = this.className || ''

    if (!this.builtClasses || this.inheritParentCSS) {
      this.builtClasses += ' inherit-parent'
    }
  }
}
