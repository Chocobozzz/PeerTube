# Dependencies

## Debian / Ubuntu and derivatives
  1. On a fresh Debian/Ubuntu, as root user, install basic utility programs needed for the installation

```
# apt-get install curl sudo unzip vim
```

  2. It would be wise to disable root access and to continue this tutorial with a user with sudoers group access

  3. Install certbot (choose instructions for nginx and your distribution) :
     [https://certbot.eff.org/all-instructions](https://certbot.eff.org/all-instructions)
  4. Install NodeJS 8.x (current LTS):
     [https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)
  5. Install yarn, and be sure to have a recent version (>= 1.5.1, the latest release):
     [https://yarnpkg.com/en/docs/install#linux-tab](https://yarnpkg.com/en/docs/install#linux-tab)
  6. Run:

```
$ sudo apt update
$ sudo apt install nginx ffmpeg postgresql openssl g++ make redis-server git
$ ffmpeg -version # Should be >= 3.x
$ g++ -v # Should be >= 5.x
```

If you still have a 2.x version of FFmpeg on Ubuntu:
```
$ sudo add-apt-repository ppa:jonathonf/ffmpeg-3
$ sudo apt-get update
$ sudo apt install ffmpeg
```

## Arch Linux

  1. Run:

```
$ sudo pacman -S nodejs-lts-carbon yarn ffmpeg postgresql openssl redis git wget unzip python2 base-devel npm nginx
```

## CentOS 7

  1. Install NodeJS 8.x (current LTS):
     [https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora)
  2. Install yarn:
     [https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)
  3. Install or compile ffmpeg:
     * Install - [https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/](https://linoxide.com/linux-how-to/install-ffmpeg-centos-7/)
     * Compile - [https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh](https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh)
  4. Run:

```
$ sudo yum update
$ sudo yum install epel-release centos-release-scl
$ sudo yum update
$ sudo yum install nginx postgresql postgresql-server openssl gcc-c++ make redis git devtoolset-6
```

  5. You need to use a more up to date version of G++ in order to run the yarn install command, hence the installation of devtoolset-6.
```
$ sudo scl devtoolset-6 bash
```

## FreeBSD

On a fresh install of [FreeBSD](https://www.freebsd.org), new system or new jail:

  1. bootstrap pkg, initialize db and install peertube's dependencies, always as root (sudo not yet installed):
```
# pkg
# pkg update
# pkg install -y sudo bash wget git python nginx pkgconf vips postgresql96-server redis openssl node npm yarn ffmpeg unzip
```

  2. Allow users in the wheel group (hope you don't forgot to add your user on wheel group!) to use sudo
```
# visudo
```

     Uncomment the line 90
```
%wheel ALL=(ALL) ALL
```

  3. Enable nginx, redis, postgresql services and initialize database
```
# ee /etc/rc.conf
```

     Add the following lines
```
postgresql_enable="YES"
redis_enable="YES"
nginx_enable="YES"
```

	 Initialize database and start services
```
# service postgresql initdb
# service postgresql start
# service redis start
# service nginx start
```

## macOS
* Add the packages:

	```
	brew install ffmpeg nginx postgresql openssl gcc make redis git yarn
	```
* Run the services:

   ```
   brew services run postgresql
   brew services run redis
   ```
   
## Other distributions

Feel free to update this file in a pull request!
