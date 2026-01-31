# Milestone 1 — Local Stack (Forgejo + Taiga)

## Forgejo

Start Forgejo:

```bash
cd docker/forgejo
docker compose up -d
```
Open:
http://localhost:3000
Notes:
For local dev, SQLite is fine.
If using SSH cloning, host port 2222 maps to container port 22.
Stop Forgejo:

```bash
docker compose down
```

## Taiga (external dependency)

Taiga is run from the official taiga-docker repo, cloned locally. We do not commit it into this repo.
Clone and start Taiga:

```bash
cd docker
git clone https://github.com/taigaio/taiga-docker taiga
cd taiga
git checkout stable

# Apple Silicon (M-series): force amd64 images
export DOCKER_DEFAULT_PLATFORM=linux/amd64

docker compose up -d
```

Create the Taiga superuser (first time only):

```bash
docker compose -f docker-compose.yml -f docker-compose-inits.yml run --rm taiga-manage createsuperuser
```

Open:
http://localhost:9000

If Taiga returns 502, restart the gateway:

```bash
docker compose restart taiga-gateway
```
Stop Taiga:

```bash
docker compose down
```