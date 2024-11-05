import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-link',
  styleUrls: [ './link.component.scss' ],
  templateUrl: './link.component.html',
  standalone: true,
  imports: [ NgIf, RouterLink, NgClass, NgTemplateOutlet, GlobalIconComponent ]
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

  @Input() icon: GlobalIconName

  builtClasses: string

  ngOnInit () {
    this.builtClasses = this.className || ''

    if (!this.builtClasses || this.inheritParentCSS) {
      this.builtClasses += ' inherit-parent'
    }
  }
}
