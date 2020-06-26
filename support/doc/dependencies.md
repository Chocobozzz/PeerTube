# Dependencies

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Debian / Ubuntu and derivatives](#debian--ubuntu-and-derivatives)
- [Arch Linux](#arch-linux)
- [CentOS 7](#centos-7)
- [Fedora](#fedora)
- [FreeBSD](#freebsd)
- [macOS](#macos)
- [Gentoo](#gentoo)
- [Other distributions](#other-distributions)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Debian / Ubuntu and derivatives

1. On a fresh Debian/Ubuntu, as root user, install basic utility programs needed for the installation

```
# apt-get install curl sudo unzip vim
```

2. It would be wise to disable root access and to continue this tutorial with a user with sudoers group access

3. Install certbot (choose instructions for nginx and your distribution) :    
[https://certbot.eff.org/all-instructions](https://certbot.eff.org/all-instructions)
4. Install NodeJS 10.x:    
[https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)
5. Install yarn, and be sure to have [a recent version](https://github.com/yarnpkg/yarn/releases/latest):    
[https://yarnpkg.com/en/docs/install#linux-tab](https://yarnpkg.com/en/docs/install#linux-tab)

6. Run:

```
sudo apt update
sudo apt install nginx ffmpeg postgresql postgresql-contrib openssl g++ make redis-server git python-dev
ffmpeg -version # Should be >= 3.x
g++ -v # Should be >= 5.x
```

If you still have a 2.x version of FFmpeg on Ubuntu:

```
sudo add-apt-repository ppa:jonathonf/ffmpeg-3
sudo apt-get update
sudo apt install ffmpeg
```

Now that dependencies are installed, before running PeerTube you should start PostgreSQL and Redis:

```
sudo systemctl start redis postgresql
```

## Arch Linux

1. Run:

```
sudo pacman -S nodejs-lts-dubnium yarn ffmpeg postgresql openssl redis git wget unzip python2 base-devel npm nginx
```

Now that dependencies are installed, before running PeerTube you should start PostgreSQL and Redis:

```
sudo systemctl start redis postgresql
```

## CentOS 7

1. Install NodeJS 10.x:    
[https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora)

2. Install yarn:    
[https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)

3. Install or compile ffmpeg:

* Install - [https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/](https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/)
* Compile - [https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh](https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh)

4. Install Packages:    

```
sudo yum update
sudo yum install epel-release centos-release-scl
sudo yum update
sudo yum install nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git devtoolset-7
```

5. You need to use a more up to date version of G++ in order to run the yarn install command, hence the installation of devtoolset-7.

```
sudo scl enable devtoolset-7 bash
```

Later when you invoke any node command, please prefix them with `CC=/opt/rh/devtoolset-7/root/usr/bin/gcc CXX=/opt/rh/devtoolset-7/root/usr/bin/g++`, such as with:

```
sudo -H -u peertube CC=/opt/rh/devtoolset-7/root/usr/bin/gcc CXX=/opt/rh/devtoolset-7/root/usr/bin/g++ yarn install --production --pure-lockfile
```

6. Initialize the PostgreSQL database:   

```
sudo postgresql-setup initdb
```

Now that dependencies are installed, before running PeerTube you should enable and start PostgreSQL and Redis:    

```
sudo systemctl enable --now redis
sudo systemctl enable --now postgresql
```

## Centos 8

1. Install NodeJS 10.x:    
[https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora)

2. Install yarn:    
[https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)

3. Install or compile ffmpeg:

* Install - [https://linuxize.com/post/how-to-install-ffmpeg-on-centos-8/](https://linuxize.com/post/how-to-install-ffmpeg-on-centos-8/)

4. Install packages:    

```
sudo dnf update
sudo dnf install epel-release 
sudo dnf update
sudo dnf install nginx postgresql postgresql-server postgresql-contrib openssl gcc-c++ make wget redis git
```

5. You'll need a symlink for python3 to python for youtube-dl to work

```
sudo ln -s /usr/bin/python3 /usr/bin/python
```

6. Initialize the PostgreSQL database:   

```
sudo postgresql-setup initdb
```

Now that dependencies are installed, before running PeerTube you should enable and start PostgreSQL and Redis:    

```
sudo systemctl enable --now redis
sudo systemctl enable --now postgresql
```


## Fedora

1. Upgrade your packages:

```
dnf upgrade
```

2. Add a user with sudoers group access:

```
useradd my-peertube-user
passwd my-peertube-user
usermod my-peertube-user -a -G wheel	# Add my-peertube-user to sudoers
su my-peertube-user
```

3. (Optional) Install certbot (choose instructions for nginx and your distribution):    
[https://certbot.eff.org/all-instructions](https://certbot.eff.org/all-instructions)

4. Install NodeJS 10.x:   
[https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora)

5. Install yarn:    
[https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)

6. Enable [RPM Fusion](https://rpmfusion.org) for Fedora (available for x86, x86_64, armhfp)

```
sudo dnf install https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
```
This is necessary because `ffmpeg` is not in the Fedora repos.

7. Run:

```
sudo dnf install nginx ffmpeg postgresql-server postgresql-contrib openssl gcc-c++ make redis git
ffmpeg -version # Should be >= 3.x
g++ -v # Should be >= 5.x
```

8. Post-installation

_from [PostgreSQL documentation](https://www.postgresql.org/download/linux/redhat/):_
> Due to policies for Red Hat family distributions, the PostgreSQL installation will not be enabled for automatic start or have the database initialized automatically.

```
# PostgreSQL
sudo postgresql-setup initdb
sudo systemctl enable postgresql.service
sudo systemctl start postgresql.service
# Nginx
sudo systemctl enable nginx.service
sudo systemctl start nginx.service
# Redis
sudo systemctl enable redis.service
sudo systemctl start redis.service
```

9. Firewall

By default, you cannot access your server via public IP. To do so, you must configure firewall:

```
# Ports used by peertube dev setup
sudo firewall-cmd --permanent --zone=public --add-port=3000/tcp
sudo firewall-cmd --permanent --zone=public --add-port=9000/tcp
# Optional
sudo firewall-cmd --permanent --zone=public --add-service=http
sudo firewall-cmd --permanent --zone=public --add-service=https
# Reload firewall
sudo firewall-cmd --reload
```

10. Configure max ports

This is necessary if you are running dev setup, otherwise you will have errors with `nodemon`   

```
echo fs.inotify.max_user_watches=582222 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

[More info](https://stackoverflow.com/questions/34662574/node-js-getting-error-nodemon-internal-watch-failed-watch-enospc#34664097)

## FreeBSD

On a fresh install of [FreeBSD](https://www.freebsd.org), new system or new jail:

1. bootstrap pkg, initialize db and install peertube's dependencies, always as root (sudo not yet installed):    

```
pkg
pkg update
pkg install -y sudo bash wget git python nginx pkgconf vips postgresql96-server postgresql96-contrib redis openssl node npm yarn ffmpeg unzip
```

2. Allow users in the wheel group (hope you don't forgot to add your user on wheel group!) to use sudo.   

```
# visudo
```

Uncomment the line 90
     
```
%wheel ALL=(ALL) ALL
```

3. Enable nginx, redis, postgresql services and initialize database.   

```
sysrc postgresql_enable="YES"
sysrc redis_enable="YES"
sysrc nginx_enable="YES"
```

Initialize database and start services

```
service postgresql initdb
service postgresql start
service redis start
service nginx start
```

## macOS

1. Add the packages:

```
brew install ffmpeg nginx postgresql openssl gcc make redis git yarn
```

2. Run the services:

```
brew services run postgresql
brew services run redis
```

## Gentoo

1. Add this to ``/etc/portage/sets/peertube``:

```
net-libs/nodejs
sys-apps/yarn
media-video/ffmpeg[x264] # Optionnally add vorbis,vpx
dev-db/postgresql
dev-db/redis
dev-vcs/git
app-arch/unzip
dev-lang/python:2.7
www-servers/nginx

# Optional, client for Let’s Encrypt:
# app-crypt/certbot
# app-crypt/certbot-nginx
```

2. If you are on a "stable" Gentoo you need to accept the testing keyword ~amd64 yarn:

```
mkdir -p /etc/portage/package.keywords
cat << EOF >> /etc/portage/package.keywords/peertube
# required by yarn (argument) for PeerTube
sys-apps/yarn ~amd64
EOF
```

3. Compile the peertube set:

```
emerge -a @peertube
```

4. Initialize the PostgreSQL database if you just merged it:

```
emerge --config postgresql
```

5. (For OpenRC) Enable and then start the services (replace with the correct PostgreSQL slot):

```
rc-update add redis
rc-update add postgresql-11
rc-service redis start
rc-service postgresql-11 start
```
   
## Other distributions

Feel free to update this file in a pull request!
