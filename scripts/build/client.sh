#!/bin/bash

set -eu

defaultLanguage="en-US"

# Supported languages (key:locale pairs) - Bash 3.2 compatible for macOS
languages=(
    ar:ar
    ca:ca-ES
    cs:cs-CZ
    de:de-DE
    el:el-GR
    en:en-US
    eo:eo
    es:es-ES
    eu:eu-ES
    fa:fa-IR
    fi:fi-FI
    fr:fr-FR
    gd:gd
    gl:gl-ES
    hr:hr
    hu:hu-HU
    is:is
    it:it-IT
    ja:ja-JP
    kab:kab
    nb:nb-NO
    nl:nl-NL
    nn:nn
    oc:oc
    pl:pl-PL
    pt:pt-BR
    pt-PT:pt-PT
    ru:ru-RU
    sk:sk-SK
    sq:sq
    sv:sv-SE
    th:th-TH
    tok:tok
    tr:tr-TR
    uk:uk-UA
    vi:vi-VN
    zh-Hans:zh-Hans-CN
    zh-Hant:zh-Hant-TW
)


rm -rf ./client/dist

npm run build:embed

cd client

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--source-map" ]; then
        additionalParams="--source-map=true"
    fi

    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --configuration production --output-path "dist/build" $additionalParams

    for entry in "${languages[@]}"; do
        key="${entry%%:*}"
        lang="${entry#*:}"

        mv "dist/build/browser/$key" "dist/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets
            rm -r "./dist/$lang/assets"
        fi
    done

    mv "./dist/$defaultLanguage/assets" "./dist"

    rm -r "dist/build"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--named-chunks=true --output-hashing=none"

        # For Vite
        export ANALYZE_BUNDLE=true
    fi

    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --localize=false --output-path "dist/$defaultLanguage/" \
                                                              --configuration production --stats-json $additionalParams
fi

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
