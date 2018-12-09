### Usage
1. Build the image:
	```
	docker build -t my_peertube_dev .
	```
1. Start the container:
	```
	docker run -d -i -p 3000:3000 -p 9000:9000 --name peertube my_peertube_dev
	```
	This will create a new Docker volume containing PeerTube sources.

1. Start PeerTube inside the container:
	```
	docker exec -it peertube npm run dev
	```
1. In another window, find the path to the Docker volume
	```
	docker inspect peertube | less +/Mounts
	```
	You can now make changes to the files. They should be automatically recompiled.
