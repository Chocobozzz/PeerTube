async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  videoPrivacyManager,
  playlistPrivacyManager
}) {
  videoLanguageManager.addLanguage('al_bhed', 'Al Bhed')
  videoLanguageManager.addLanguage('al_bhed2', 'Al Bhed 2')
  videoLanguageManager.deleteLanguage('en')
  videoLanguageManager.deleteLanguage('fr')

  videoCategoryManager.addCategory(42, 'Best category')
  videoCategoryManager.addCategory(43, 'High best category')
  videoCategoryManager.deleteCategory(1) // Music
  videoCategoryManager.deleteCategory(2) // Films

  videoLicenceManager.addLicence(42, 'Best licence')
  videoLicenceManager.addLicence(43, 'High best licence')
  videoLicenceManager.deleteLicence(1) // Attribution
  videoLicenceManager.deleteLicence(7) // Public domain

  videoPrivacyManager.deletePrivacy(2)
  playlistPrivacyManager.deletePlaylistPrivacy(3)
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ############################################################################

function addToCount (obj) {
  return Object.assign({}, obj, { count: obj.count + 1 })
}
