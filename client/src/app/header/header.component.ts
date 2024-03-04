import { Component } from '@angular/core'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { RouterLink } from '@angular/router'
import { SearchTypeaheadComponent } from './search-typeahead.component'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
  standalone: true,
  imports: [ SearchTypeaheadComponent, RouterLink, GlobalIconComponent ]
})

export class HeaderComponent {}
