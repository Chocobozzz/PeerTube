async function register ({
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  videoPrivacyManager,
  playlistPrivacyManager,
  getRouter
}) {
  videoLanguageManager.addLanguage('al_bhed', 'Al Bhed')
  videoLanguageManager.addLanguage('al_bhed2', 'Al Bhed 2')
  videoLanguageManager.addLanguage('al_bhed3', 'Al Bhed 3')
  videoLanguageManager.deleteLanguage('en')
  videoLanguageManager.deleteLanguage('fr')
  videoLanguageManager.deleteLanguage('al_bhed3')

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

  {
    const router = getRouter()
    router.get('/reset-categories', (req, res) => {
      videoCategoryManager.resetCategories()

      res.sendStatus(204)
    })
  }
}

async function unregister () {}

module.exports = {
  register,
  unregister
}
