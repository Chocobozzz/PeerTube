### Usage
1. Build the image:
	```
	docker-compose build
	```
2. Start the container:
	```
	docker-compose --env-file ./support/docker/development/.env.local up -d
	```
	Or without daemon:
	```
	docker-compose --env-file ./support/docker/development/.env.local up
	```
	Wait all resources will started.

3. Change root user password:

   `docker-compose exec peertube npm run reset-password -- -u root`

4. Remove containers:
    ```
    docker-compose --env-file ./support/docker/development/.env.local down
    ```
    Or also remove volumes:
    
    :warning: This step will remove all data e.g. plugins, videos, db, etc...
    ```
    docker-compose --env-file ./support/docker/development/.env.local down -v