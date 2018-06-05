import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { TabsetComponent } from 'ngx-bootstrap/tabs'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  templateUrl: './follows.component.html',
  styleUrls: [ './follows.component.scss' ]
})
export class FollowsComponent implements OnInit, AfterViewInit {
  @ViewChild('followsMenuTabs') followsMenuTabs: TabsetComponent

  links: { path: string, title: string }[] = []

  constructor (
    private i18n: I18n,
    private router: Router
  ) {
    this.links = [
      {
        path: 'following-list',
        title: this.i18n('Following')
      },
      {
        path: 'following-add',
        title: this.i18n('Follow')
      },
      {
        path: 'followers-list',
        title: this.i18n('Followers')
      }
    ]
  }

  ngOnInit () {
    this.router.events.subscribe(
      event => {
        if (event instanceof NavigationEnd) {
          this.updateActiveTab()
        }
      }
    )
  }

  ngAfterViewInit () {
    // Avoid issue with change detector
    setTimeout(() => this.updateActiveTab())
  }

  private updateActiveTab () {
    const url = window.location.pathname

    for (let i = 0; i < this.links.length; i++) {
      const path = this.links[i].path

      if (url.endsWith(path) === true && this.followsMenuTabs.tabs[i]) {
        this.followsMenuTabs.tabs[i].active = true
        return
      }
    }
  }
}
