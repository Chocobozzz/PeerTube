import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsPanel extends Component {

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel',
      tabIndex: -1
    })
  }
}

Component.registerComponent('SettingsPanel', SettingsPanel)

export { SettingsPanel }
