create database peertube_dev;
create user peertube password 'peertube';
grant all privileges on database peertube_dev to peertube;
