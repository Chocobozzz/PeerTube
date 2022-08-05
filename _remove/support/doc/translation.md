# Translation

We use [Weblate](https://weblate.org) as translation platform.
Please do not edit translation files directly from Git, you have to use Weblate!

If you don't see your locale in the platform you can add it directly in the Weblate interface.
Then, if you think there are enough translated strings, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues) so we add the new locale in PeerTube!


## How to

 * Create an account: https://weblate.framasoft.org/accounts/register/
 * Validate your email and follow the link sent
 * Create your password (keep the `Current password` field empty) and setup your account
 * Go to the PeerTube page https://weblate.framasoft.org/projects/peertube/
 * Choose the file and the locale you want to translate
 

## Files

There are 4 files:
 * **angular**: contains client strings
 * **player**: contains player strings. 
 Most of the strings come from VideoJS, so you can help yourself by using [video.js JSON files](https://github.com/videojs/video.js/tree/master/lang)
 * **server**: contains server strings (privacies, licences...) and iso639 (languages) strings used by PeerTube to describe the audio language of a particular video.
 It's the reason why these strings should be translated too. There are many strings so do not hesitate to translate only main audio languages.


## Tips

### Special tags

You must not translate special tags like `<x id="INTERPOLATION" ... />`.

For example: 
```<x id="INTERPOLATION" equiv-text="{{ video.publishedAt | myFromNow }}"/> - <x id="INTERPOLATION_1" equiv-text="{{ video.views | myNumberFormatter }}"/> views```

should be in french 
```<x id="INTERPOLATION" equiv-text="{{ video.publishedAt | myFromNow }}"/> - <x id="INTERPOLATION_1" equiv-text="{{ video.views | myNumberFormatter }}"/> vues```


### Singular/plural

For singular/plural translations, you must translate values inside `{` and `}`. **Please don't translate the word *other***

For example:

```{VAR_PLURAL, plural, =0 {No videos} =1 {1 video} other {<x id="INTERPOLATION" equiv-text="{{ playlist.videosLength }}"/> videos} }```

should be in french 

```{VAR_PLURAL, plural, =0 {Aucune vidéo} =1 {1 vidéo} other {<x id="INTERPOLATION" equiv-text="{{ playlist.videosLength }}"/> vidéos} }```
