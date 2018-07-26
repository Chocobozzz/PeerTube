# Translation

We use [Zanata](http://zanata.org/) as translation platform.
Please do not edit xml files directly from Git, you have to use Zanata!

If you don't see your locale in the platform, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues) so we add it!


## How to

 * Create an account: https://trad.framasoft.org/account/register
 * Join a language team: https://trad.framasoft.org/languages
 * Go to the PeerTube page https://trad.framasoft.org/iteration/view/peertube/develop
 * Choose the locale and begin to translate PeerTube!
 

## Files

There are 4 files:
 * **angular**: contains client strings
 * **player**: contains player strings. 
 Most of the strings come from VideoJS, so you can help yourself by using [video.js JSON files](https://github.com/videojs/video.js/tree/master/lang)
 * **server**: contains server strings (privacies, licences...)
 * **iso639**: contains iso639 (languages) strings used by PeerTube to describe the audio language of a particular video.
 It's the reason why these strings should be translated too. There are many strings so do not hesitate to translate only main audio languages.

## Tips

You must not translate special tags like `<x id="INTERPOLATION" ... />`.

For example: 
```<x id="INTERPOLATION" equiv-text="{{ video.publishedAt | myFromNow }}"/> - <x id="INTERPOLATION_1" equiv-text="{{ video.views | myNumberFormatter }}"/> views```

should be in french 
```<x id="INTERPOLATION" equiv-text="{{ video.publishedAt | myFromNow }}"/> - <x id="INTERPOLATION_1" equiv-text="{{ video.views | myNumberFormatter }}"/> vues```