#!/bin/bash

set -eu

pre_build_hook () {
  mkdir "./src/pending_locale" > /dev/null || true
  mv ./src/locale/angular.*.xlf "./src/pending_locale"

  if [ ! -z ${1+x} ]; then
    mv "./src/pending_locale/angular.$1.xlf" "./src/locale"
  fi
}

post_build_hook () {
  mv ./src/pending_locale/* "./src/locale"
  rmdir "./src/pending_locale/"
}

# Previous build failed
if [ ! -f "client/src/locale/angular.fr-FR.xlf" ]; then
    git checkout -- client/src/locale/
    rm -r client/src/pending_locale
fi

cd client

rm -rf ./dist ./compiled

pre_build_hook

defaultLanguage="en-US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json
mv "./dist/$defaultLanguage/assets" "./dist"
mv "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"

post_build_hook

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || [ "$1" != "--light" ]; then
    if [ ! -z ${1+x} ] && [ "$1" == "--light-fr" ]; then
        languages=("fr-FR")
    else
        # Supported languages
        languages=(
            "fi-FI" "nl-NL" "gd" "el-GR" "es-ES" "oc" "pt-BR" "pt-PT" "sv-SE" "pl-PL" "ru-RU" "zh-Hans-CN" "zh-Hant-TW"
            "fr-FR" "ja-JP" "eu-ES" "ca-ES" "cs-CZ" "eo" "de-DE" "it-IT"
        )
    fi

    for lang in "${languages[@]}"; do
        # TODO: remove when the project will use runtime translations
        pre_build_hook "$lang"

        npm run ng build -- --prod --i18n-file "./src/locale/angular.$lang.xlf" --i18n-format xlf --i18n-locale "$lang" \
            --output-path "dist/$lang/" --deploy-url "/client/$lang/"

        # Do not duplicate assets
        rm -r "./dist/$lang/assets"

        # TODO: remove when the project will use runtime translations
        post_build_hook
    done
fi

NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production --json > "./dist/embed-stats.json"

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
