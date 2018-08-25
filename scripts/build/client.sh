#!/bin/bash

set -eu

pre_build_hook () {
  mkdir "./src/locale/pending_target/" > /dev/null || true
  mv ./src/locale/target/angular_*.xml "./src/locale/pending_target"

  if [ ! -z ${1+x} ]; then
    mv "./src/locale/pending_target/angular_$1.xml" "./src/locale/target"
  fi
}

post_build_hook () {
  mv ./src/locale/pending_target/* "./src/locale/target/"
  rmdir "./src/locale/pending_target/"
}

# Previous build failed
if [ ! -f client/src/locale/target/angular_fr_FR.xml ]; then
    git checkout -- client/src/locale/target/
    rm -r client/src/locale/pending_target/
fi

cd client

rm -rf ./dist ./compiled

pre_build_hook

defaultLanguage="en_US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json
mv "./dist/$defaultLanguage/assets" "./dist"

post_build_hook

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || [ "$1" != "--light" ]; then
    if [ ! -z ${1+x} ] && [ "$1" == "--light-fr" ]; then
        languages=("fr_FR")
    else
        # Supported languages
        languages=("fr_FR" "eu_ES" "ca_ES" "cs_CZ" "eo" "zh_Hant_TW" "de_DE" "es_ES" "oc")
    fi

    for lang in "${languages[@]}"; do
        # TODO: remove when the project will use runtime translations
        pre_build_hook "$lang"

        npm run ng build -- --prod --i18n-file "./src/locale/target/angular_$lang.xml" --i18n-format xlf --i18n-locale "$lang" \
            --output-path "dist/$lang/" --deploy-url "/client/$lang/"

        # Do no duplicate assets
        rm -r "./dist/$lang/assets"

        # TODO: remove when the project will use runtime translations
        post_build_hook
    done
fi

NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production --json > "./dist/embed-stats.json"

# Copy runtime locales
cp -r "./src/locale/target" "./dist/locale"