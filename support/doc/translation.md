# Translation

We use [Zanata](http://zanata.org/) as translation platform. 
Please do not edit xml files directly from Git, you have to use Zanata!

If you don't see your locale in the platform, please [create an issue](https://github.com/Chocobozzz/PeerTube/issues) so we add it!


## How to

 * Create an account: https://trad.framasoft.org/zanata/?dswid=-7191
 * Join a language team: https://trad.framasoft.org/zanata/languages?dswid=-7191
 * Go to the PeerTube page https://trad.framasoft.org/zanata/iteration/view/peertube/develop/languages/fr?dswid=-6462
 * Choose the locale and begin to translate PeerTube!
 

## Files

There are 4 files:
 * **angular**: contains client strings
 * **player**: contains player strings
 * **server**: contains server strings (language, licence...)
 * **iso639**: contains iso639 (languages) strings used by PeerTube to describe the audio language of a particular video.
 It's the reason why these strings should be translated too. There are many strings so do not hesitate to translate only main audio languages. 