#!/bin/sh

set -eu

echo -e "# Code\n"

curl -s https://api.github.com/repos/chocobozzz/peertube/contributors | \
  jq -r 'map(" * [" + .login + "](" + .url + ")") | .[]' | \
  sed 's/api.github.com\/users/github.com/g'

###################################################

echo -e "\n\n# Translations\n"

curl -s \
    -H "Accept: application/json" \
    -H "X-Auth-User: $(grep trad.framasoft.org.username ~/.config/zanata.ini | sed 's@.*=@@')" \
    -H "X-Auth-Token: $(grep trad.framasoft.org.key ~/.config/zanata.ini | sed 's@.*=@@')" \
    "https://trad.framasoft.org/zanata/rest/project/peertube/version/develop/contributors/2018-01-01..$(date +%Y-%m-%d)" \
    | jq -r 'map(" * [" + .username + "](https://trad.framasoft.org/zanata/profile/view/" + .username + ")") | .[]'

###################################################

echo -e "\n\n# Design\n"

echo -e "By [Olivier Massain](https://twitter.com/omassain)\n"
echo -e "Icons from [Robbie Pearce](https://robbiepearce.com/softies/)"