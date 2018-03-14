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
  5. Install yarn:
     [https://yarnpkg.com/en/docs/install#linux-tab](https://yarnpkg.com/en/docs/install#linux-tab)
  6. Run:

```
$ sudo apt update
$ sudo apt install nginx ffmpeg postgresql openssl g++ make redis-server git
$ ffmpeg -version # Should be >= 3.x 
```

## Arch Linux

  1. Run:

```
$ sudo pacman -S nodejs yarn ffmpeg postgresql openssl redis git wget unzip python2 base-devel npm nginx
```

## CentOS 7

  1. Install NodeJS 8.x (current LTS):
     [https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora)
  2. Install yarn:
     [https://yarnpkg.com/en/docs/install](https://yarnpkg.com/en/docs/install)
  3. Install or compile ffmpeg:
     * Install - [https://www.webfoobar.com/index.php/node/17](https://www.webfoobar.com/index.php/node/17)
     * Compile - [https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh](https://gist.github.com/mustafaturan/7053900#file-latest-ffmpeg-centos6-sh)
  4. Run:

```
$ sudo yum update
$ sudo yum install epel-release
$ sudo yum update
$ sudo yum install nginx postgresql postgresql-server openssl gcc make redis git
```

## Other distributions

Feel free to update this file in a pull request!

