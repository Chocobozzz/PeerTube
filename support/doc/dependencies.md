# Dependencies

:warning: **Warning**: dependencies guide is maintained by the community. Some parts may be outdated! :warning:

Main dependencies supported by PeerTube:

 * `node` LTS (**>= 20.19 and < 21** or **>= 22.12 and <23**)
 * `yarn` 1.x for **PeerTube <= 7.3** or `pnpm` >= 10.x for **PeerTube >= 8.0**
 * `postgres` >=10.x
 * `redis-server` >=6.x
 * `ffmpeg` >=4.3 (using a ffmpeg static build [is not recommended](https://github.com/Chocobozzz/PeerTube/issues/6308))
 * `python` >=3.8
 * `pip`


_note_: only **LTS** versions of external dependencies are supported. If no LTS version matching the version constraint is available, only **release** versions are supported.

[[toc]]

## Debian / Ubuntu and derivatives

1. On a fresh Debian/Ubuntu, as root user, install basic utility programs needed for the installation

    ```sh
    sudo apt-get install curl sudo unzip vim
    ```

1. It would be wise to disable root access and to continue this tutorial with a user with sudoers group access. You can see a guide for how to do this in Debian/Ubuntu [here](https://www.digitalocean.com/community/tutorials/how-to-add-and-delete-users-on-ubuntu-20-04).

1. Install NodeJS 20.x: https://nodesource.com/products/distributions

1. **PeerTube <= v7.3 only** Install yarn, and be sure to have [a recent version](https://github.com/yarnpkg/yarn/releases/latest):
[https://yarnpkg.com/en/docs/install#linux-tab](https://yarnpkg.com/en/docs/install#linux-tab)

1. **PeerTube >= v8.0 only** Install [PNPM](https://pnpm.io/fr/installation):

    ```sh
    sudo npm install -g pnpm
    ```

1. Install Python:

    ```sh
    sudo apt update
    sudo apt install python3-dev python3-pip python-is-python3
    python --version # Should be >= 3.8
    ```

1. Install common dependencies:

    ```sh
    sudo apt update
    sudo apt install certbot nginx ffmpeg postgresql postgresql-contrib openssl g++ make redis-server git cron wget
    ffmpeg -version # Should be >= 4.1
    g++ -v # Should be >= 5.x
    redis-server --version # Should be >= 6.x
    ```

Now that dependencies are installed, before running PeerTube you should start PostgreSQL and Redis:

```sh
sudo systemctl start redis postgresql
```

## Arch Linux

Run:

```sh
sudo pacman -S nodejs-lts-iron yarn ffmpeg postgresql openssl redis git wget unzip python python-pip base-devel npm nginx
sudo pacman -S yarn # PeerTube <= v7.3 only
sudo pacman -S pnpm # PeerTube >= v8.0 only
```

Now that dependencies are installed, before running PeerTube you should start PostgreSQL and Redis:

```sh
sudo systemctl start redis postgresql
```

## CentOS 7

1. Install NodeJS 20.x: https://nodesource.com/products/distributions

1. **PeerTube <= v7.3 only** Install [yarn](https://yarnpkg.com/en/docs/install):

1. **PeerTube >= v8.0 only** Install [PNPM](https://pnpm.io/fr/installation):

    ```sh
    sudo npm install -g pnpm
    ````

1. Install or compile ffmpeg:

    * Install - [https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/](https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/)
    * Compile - [https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh](https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh)

1. Install Packages:

    ```sh
    sudo yum update
    sudo yum install epel-release centos-release-scl
    sudo yum update
    sudo yum install nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git devtoolset-7
    ```

1. You need to use a more up to date version of G++ in order to run the `npm run install-node-dependencies` command, hence the installation of devtoolset-7.

    ```sh
    sudo scl enable devtoolset-7 bash
    ```

    Later when you invoke any node command, please prefix them with `CC=/opt/rh/devtoolset-7/root/usr/bin/gcc CXX=/opt/rh/devtoolset-7/root/usr/bin/g++`, such as with:

    ```sh
    sudo -H -u peertube CC=/opt/rh/devtoolset-7/root/usr/bin/gcc CXX=/opt/rh/devtoolset-7/root/usr/bin/g++ npm run install-node-dependencies -- --production
    ```

1. Initialize the PostgreSQL database:

    ```sh
    sudo PGSETUP_INITDB_OPTIONS='--auth-host=md5' postgresql-setup --initdb --unit postgresql
    ```

Now that dependencies are installed, before running PeerTube you should enable and start PostgreSQL and Redis:

```sh
sudo systemctl enable --now redis
sudo systemctl enable --now postgresql
```

## Centos 8

1. Install NodeJS 20.x: https://nodesource.com/products/distributions

1. **PeerTube <= v7.3 only** Install yarn:
[https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)

1. **PeerTube >= v8.0 only** Install [PNPM](https://pnpm.io/fr/installation):

    ```sh
    sudo npm install -g pnpm
    ````

1. Install or compile ffmpeg:

    ```sh
    sudo dnf install epel-release dnf-utils
    sudo yum-config-manager --set-enabled powertools
    sudo yum-config-manager --add-repo=https://negativo17.org/repos/epel-multimedia.repo
    sudo dnf install ffmpeg
    ```

1. Install packages:

    ```sh
    sudo dnf update
    sudo dnf install epel-release
    sudo dnf update
    sudo dnf install nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git unzip
    ```

1. You'll need a symlink for python3 to python for youtube-dl to work

    ```sh
    sudo ln -s /usr/bin/python3 /usr/bin/python
    ```

1. Initialize the PostgreSQL database:

    ```sh
    sudo PGSETUP_INITDB_OPTIONS='--auth-host=md5' postgresql-setup --initdb --unit postgresql
    ```

Now that dependencies are installed, before running PeerTube you should enable and start PostgreSQL and Redis:

```sh
sudo systemctl enable --now redis
sudo systemctl enable --now postgresql
```

## Rocky Linux 8.4

1. Pull the latest updates:
    ```sh
    sudo dnf update -y
    ```

1. Install NodeJS 20.x:
    ```sh
    sudo dnf module install -y nodejs:20
    ```

1. **PeerTube <= v7.3 only** Install yarn:
    ```sh
    sudo npm install --global yarn
    ```

1. **PeerTube >= v8.0 only** Install PNPM:
    ```sh
    sudo npm install --global pnpm
    ```

1. Install or compile ffmpeg (if you want to compile... enjoy):
    ```sh
    sudo dnf install -y epel-release
    sudo dnf --enablerepo=powertools install -y SDL2 SDL2-devel
    sudo dnf install -y --nogpgcheck https://download1.rpmfusion.org/free/el/rpmfusion-free-release-8.noarch.rpm https://download1.rpmfusion.org/nonfree/el/rpmfusion-nonfree-release-8.noarch.rpm
    sudo dnf install -y ffmpeg
    sudo dnf update -y
    ```

1. Install PostgreSQL and Python3 and other stuff:
    ```sh
    sudo dnf install -y nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git python3 python3-pip
    sudo ln -s /usr/bin/python3 /usr/bin/python
    sudo PGSETUP_INITDB_OPTIONS='--auth-host=md5' postgresql-setup --initdb --unit postgresql
    sudo systemctl enable --now redis
    sudo systemctl enable --now postgresql
    ```

1. Unknown missing steps:
    - Steps missing here... these were adapted from the CentOS 8 steps which abruptly ended.
    - /var/www/peertube does not exist yet (expected? done in future steps? documentation?).
    - Nothing about Certbot, NGINX, Firewall settings, and etc.
    - Hopefully someone can suggest what is missing here with some hints so I can add it?

## Fedora

1. Upgrade your packages:

    ```sh
    dnf upgrade
    ```

1. (Optional) Install certbot (choose instructions for your distribution):
[https://certbot.eff.org/all-instructions](https://certbot.eff.org/all-instructions)

1. Install NodeJS 20.x: https://nodesource.com/products/distributions

1. **PeerTube <= v7.3 only** Install yarn:
[https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)

1. **PeerTube >= v8.0 only** Install PNPM:
    ```sh
    sudo npm install --global pnpm
    ```

1. Enable [RPM Fusion](https://rpmfusion.org) for Fedora (available for x86, x86_64, armhfp)

    ```sh
    sudo dnf install https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
    ```

    This is necessary because `ffmpeg` is not in the Fedora repos.

1. Run:

    ```sh
    sudo dnf install nginx ffmpeg postgresql-server postgresql-contrib openssl gcc-c++ make redis git vim
    ffmpeg -version # Should be >= 4.1
    g++ -v # Should be >= 5.x
    redis-server --version # Should be >= 6.x
    ```

1. Configure nginx

    ```sh
    sudo mkdir /etc/nginx/sites-available
    sudo mkdir /etc/nginx/sites-enabled
    sudo ln -s /etc/nginx/sites-enabled/peertube /etc/nginx/conf.d/peertube.conf
    ```

1. Post-installation

    _from [PostgreSQL documentation](https://www.postgresql.org/download/linux/redhat/):_
    > Due to policies for Red Hat family distributions, the PostgreSQL installation will not be enabled for automatic start or have the database initialized automatically.

    ```sh
    # PostgreSQL
    sudo PGSETUP_INITDB_OPTIONS='--auth-host=md5' postgresql-setup --initdb --unit postgresql
    sudo systemctl enable postgresql.service
    sudo systemctl start postgresql.service
    # Nginx
    sudo systemctl enable nginx.service
    sudo systemctl start nginx.service
    # Redis
    sudo systemctl enable redis.service
    sudo systemctl start redis.service
    ```

1. Firewall

    By default, you cannot access your server via public IP. To do so, you must configure the firewall.

      Ports used by peertube dev setup:
    ```sh
    sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
    sudo firewall-cmd --permanent --zone=public --add-port=9000/tcp
    ```

    * Optional

    ```sh
    sudo firewall-cmd --permanent --zone=public --add-service=http
    sudo firewall-cmd --permanent --zone=public --add-service=https
    ```

    * Reload firewall

    ```sh
    sudo firewall-cmd --reload
    ```

1. Configure max ports

    This is necessary if you are running dev setup, otherwise you will have errors with `nodemon`

    ```sh
    echo fs.inotify.max_user_watches=582222 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
    ```

    [More info](https://stackoverflow.com/questions/34662574/node-js-getting-error-nodemon-internal-watch-failed-watch-enospc#34664097)

## Red Hat Enterprise Linux 8

1. Register system as root user to Red Hat Subscription Management (create a free Red Hat account if you don't have one yet).

    ```sh
    subscription-manager register --username <username> --password <password> --auto-attach
    dnf upgrade
    reboot
    ```

1. Install NodeJS

    ```sh
    sudo dnf module install nodejs:20
    ```

1. **PeerTube <= v7.3 only** Install Yarn

    ```sh
    curl --silent --location https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
    sudo dnf install yarn
    ```

1. **PeerTube >= v8.0 only** Install PNPM:
    ```sh
    sudo npm install --global pnpm
    ```

1. Install FFmpeg

    ```sh
    sudo subscription-manager repos --enable "codeready-builder-for-rhel-8-$(arch)-rpms"
    sudo dnf install --nogpgcheck https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
    sudo dnf install --nogpgcheck https://mirrors.rpmfusion.org/free/el/rpmfusion-free-release-8.noarch.rpm
    sudo dnf upgrade
    sudo dnf install ffmpeg
    ```

1. Run:

    ```sh
    sudo dnf install nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git
    ```

1. You'll need a symlink for python3 to python for youtube-dl to work

    ```sh
    sudo alternatives --set python3 /usr/bin/python
    ```

1. Initialize the PostgreSQL database:

    ```sh
    sudo PGSETUP_INITDB_OPTIONS='--auth-host=md5' postgresql-setup --initdb --unit postgresql
    ```

    Now that dependencies are installed, before running PeerTube you should enable and start PostgreSQL and Redis:

    ```sh
    sudo systemctl enable --now redis
    sudo systemctl enable --now postgresql
    ```

    If you are running the production guide, you also need to slightly pre-configure nginx, because nginx is packaged differently in the Red Hat family distributions:

1. Configure nginx

    ```sh
    sudo mkdir /etc/nginx/sites-available
    sudo mkdir /etc/nginx/sites-enabled
    sudo ln -s /etc/nginx/sites-enabled/peertube /etc/nginx/conf.d/peertube.conf
    sudo systemctl enable --now nginx
    ```

1. Firewall

    By default, you cannot access your server via public IP. To do so, you must configure firewall:

    * Ports used by peertube dev setup:
    ```sh
    sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
    sudo firewall-cmd --permanent --zone=public --add-port=9000/tcp
    ```
    * Optional

    ```sh
    sudo firewall-cmd --permanent --zone=public --add-service=http
    sudo firewall-cmd --permanent --zone=public --add-service=https
    ```

    * Reload firewall

    ```sh
    sudo firewall-cmd --reload
    ```

1. Configure max ports

    This is necessary if you are running dev setup, otherwise you will have errors with `nodemon`

    ```sh
    echo fs.inotify.max_user_watches=582222 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
    ```

    [More info](https://stackoverflow.com/questions/34662574/node-js-getting-error-nodemon-internal-watch-failed-watch-enospc#34664097)


## FreeBSD

On a fresh install of [FreeBSD](https://www.freebsd.org), new system or new jail:

1. bootstrap pkg, initialize db and install peertube's dependencies, always as root (sudo not yet installed):

    ```sh
    pkg
    pkg update
    pkg install -y sudo bash wget git python nginx pkgconf postgresql13-server postgresql13-contrib redis openssl node npm yarn ffmpeg unzip
    ```

1. **PeerTube <= v7.3 only** Install Yarn:
    ```sh
    pkg install -y yarn
    ```

1. **PeerTube >= v8.0 only** Install PNPM:
    ```sh
    sudo npm install --global pnpm
    ```

1. Allow users in the wheel group (hope you don't forgot to add your user on wheel group!) to use sudo.

    ```sh
    visudo
    ```

    Uncomment the line 90

    ```
    %wheel ALL=(ALL) ALL
    ```

1. Enable nginx, redis, postgresql services and initialize database.

    ```sh
    sysrc postgresql_enable="YES"
    sysrc redis_enable="YES"
    sysrc nginx_enable="YES"
    ```

    Initialize database and start services

    ```sh
    service postgresql initdb
    service postgresql start
    service redis start
    service nginx start
    ```

## macOS

1. Add the packages:

    ```sh
    brew install bash ffmpeg nginx postgresql openssl gcc make redis git
    brew install yarn # PeerTube <= v7.3 only
    brew install pnpm # PeerTube >= v8.0 only
    ```

    You may need to update your default version of bash.

    **How to change your default shell**

    ```sh
    which -a bash # Check where bash is installed
    bash --version # You need a version at least as recent as 4.0
    sudo vim /etc/shells # Add in this file : /usr/local/bin/bash
    chsh -s /usr/local/bin/bash # To set the brew-installed bash as default bash
    ```

    In a new shell, type `bash --version` to assert your changes took effect and
    correctly modified your default bash version.

1. Run the services:

    ```sh
    brew services run postgresql
    brew services run redis
    ```

    On macOS, the `postgresql` user can be `_postgres` instead of `postgres`.
    If `sudo -u postgres createuser -P peertube` gives you an `unknown user: postgres` error, you can try `sudo -u _postgres createuser -U peertube`.

## Gentoo

1. Add this to ``/etc/portage/sets/peertube``:

    ```
    net-libs/nodejs
    sys-apps/yarn
    sys-apps/pnpm
    media-video/ffmpeg[x264] # Optionally add vorbis,vpx
    dev-db/postgresql
    dev-db/redis
    dev-vcs/git
    app-arch/unzip
    dev-lang/python
    dev-lang/python-exec
    www-servers/nginx

    # Optional, client for Let’s Encrypt:
    # app-crypt/certbot
    ```

1. If you are on a "stable" Gentoo you need to accept the testing keyword ~amd64 yarn:

    ```sh
    mkdir -p /etc/portage/package.keywords
    cat << EOF >> /etc/portage/package.keywords/peertube
    # required by yarn (argument) for PeerTube
    sys-apps/yarn ~amd64
    sys-apps/pnpm ~amd64
    EOF
    ```

1. Compile the peertube set:

    ```sh
    emerge -a @peertube
    ```

1. Initialize the PostgreSQL database if you just merged it:

    ```sh
    emerge --config postgresql
    ```

1. (For OpenRC) Enable and then start the services (replace with the correct PostgreSQL slot):

    ```sh
    rc-update add redis
    rc-update add postgresql-11
    rc-service redis start
    rc-service postgresql-11 start
    ```

1. Create Python version symlink for youtube-dl:

    ```sh
    emerge -1 python-exec
    ```

## OpenBSD

1. Install Packages:

    ```sh
    pkg_add sudo bash wget git python nginx pkgconf postgresql-server postgresql-contrib redis openssl
    ```

1. **PeerTube <= v7.3 only** Install yarn:

    ```sh
    npm install --global yarn
    ```

1. **PeerTube >= v8.0 only** Install PNPM:
    ```sh
    sudo npm install --global pnpm
    ```

1. Allow users in the wheel group to use sudo

    ```sh
    visudo
    ```
    Uncomment line #43:

    ```
    %wheel ALL=(ALL) ALL
    ```

1. Enable services:

    ```sh
    rcctl enable postgresql redis nginx
    ```

## Other distributions

Feel free to update this file in a pull request!
