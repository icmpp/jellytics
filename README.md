<div align="center">

```
     ██╗███████╗██╗     ██╗  ██╗   ██╗████████╗██╗ ██████╗███████╗
     ██║██╔════╝██║     ██║  ╚██╗ ██╔╝╚══██╔══╝██║██╔════╝██╔════╝
     ██║█████╗  ██║     ██║   ╚████╔╝    ██║   ██║██║     ███████╗
██   ██║██╔══╝  ██║     ██║    ╚██╔╝     ██║   ██║██║     ╚════██║
╚█████╔╝███████╗███████╗███████╗██║      ██║   ██║╚██████╗███████║
 ╚════╝ ╚══════╝╚══════╝╚══════╝╚═╝      ╚═╝   ╚═╝ ╚═════╝╚══════╝
```

### 📺 Your Jellyfin. Now with the stats it deserves.

[![Docker Pulls](https://img.shields.io/docker/pulls/icmppp/jellytics?style=for-the-badge&logo=docker&logoColor=white&label=Docker%20Pulls&color=0db7ed)](https://hub.docker.com/r/icmppp/jellytics)
[![Image Size](https://img.shields.io/docker/image-size/icmppp/jellytics/latest?style=for-the-badge&logo=docker&logoColor=white&color=0db7ed)](https://hub.docker.com/r/icmppp/jellytics)
[![Stars](https://img.shields.io/github/stars/icmpp/jellytics?style=for-the-badge&logo=github&color=f5c518)](https://github.com/icmpp/jellytics)
[![License](https://img.shields.io/github/license/icmpp/jellytics?style=for-the-badge&color=9b59b6)](LICENSE)

**Jellytics** connects to your Jellyfin server and gives you a beautiful dashboard for everything you watch.
Track your habits. Rate what you love. Build watchlists. See what the whole household is watching, all in one place, all self-hosted, all yours.

[🐳 Docker Hub](https://hub.docker.com/r/icmppp/jellytics) · [🐛 Report a Bug](https://github.com/icmpp/jellytics/issues) · [💡 Request a Feature](https://github.com/icmpp/jellytics/issues)

</div>

---

## ✨ Features

> Everything you wish Jellyfin tracked, but didn't.

🗓️ **Watch Statistics:** Daily snapshots of your viewing habits broken down by genre, time, and content type. See exactly how much of your life you've given to television.

📜 **Full Watch History:** Every single thing you've ever watched, timestamped and searchable. No more "wait, did I already watch that?"

⭐ **Ratings & Reviews:** Score anything out of 10 and write personal notes or a full review. Your opinions, stored forever.

🔖 **Watchlist:** Save what you want to watch next. Never lose a recommendation again.

🗂️ **Custom Collections:** Group your media however your brain works, by franchise, director, mood, genre, or anything else.

🏷️ **Tags:** Create your own colored labels and slap them on anything. Your library, your rules.

🤖 **Recommendations:** Personalized suggestions based on what you _actually_ watch, not what an algorithm thinks you should.

📡 **Live Sessions:** See what's playing right now across every screen in your home, in real time.

👨‍👩‍👧‍👦 **Multi-User:** Every Jellyfin account in your household gets their own private profile, stats, watchlist, and preferences. Completely separate.

📦 **Archive:** Done with a series forever? Archive it to keep things tidy without losing any data.

🔔 **Notifications:** In-app alerts for sync events and household activity.

---

## 🚀 Getting Started

You need two things:

- 🐳 **Docker** + **Docker Compose v2+** on your server
- 📺 A running **Jellyfin** server on your network

### 1️⃣ Create your compose file

Drop this into a new file called `docker-compose.yml`:

```yaml
services:
  jellytics:
    image: icmppp/jellytics:latest
    container_name: jellytics
    restart: unless-stopped
    ports:
      - "80:3000"
    volumes:
      - jellytics-data:/app/data
    environment:
      - JELLYTICS_DATABASE_PATH=/app/data/jellytics.db
      # 👇 Keeps sessions alive across restarts. Generate with: openssl rand -base64 32
      # - JWT_SECRET=your_secret_here

volumes:
  jellytics-data:
```

### 2️⃣ Fire it up

```bash
docker compose up -d
```

### 3️⃣ Open it up

Head to **http://your-server-ip** in your browser. A quick setup wizard will walk you through connecting your Jellyfin server. Just enter your Jellyfin URL, username, and password. Done. Your library starts syncing automatically. 🎉

---

## ⚙️ Configuration

Most people won't need to touch a thing. But here's what's worth knowing about:

### 🔌 Change the port

Jellytics uses port **80** by default. Change the left number to whatever you want:

```yaml
ports:
  - "8096:3000" # → now at http://your-server:8096
```

### 🔐 Keep sessions alive across restarts

Without this set, everyone gets logged out whenever the container restarts. Generate a secret once:

```bash
openssl rand -base64 32
```

Then add it to `environment` in your compose file:

```yaml
- JWT_SECRET=paste_your_generated_secret_here
```

### 🔄 Control how often the library syncs

```yaml
- JELLYTICS_SYNC_INTERVAL_SECONDS=300 # every 5 minutes (this is the default)
```

### 🔒 Localhost-only mode

Running a reverse proxy in front? Lock Jellytics to local access only:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

---

## 🌐 Putting it behind a domain

Want to access Jellytics at `jellytics.yourdomain.com`? Point your reverse proxy at port **3000**.

<details>
<summary><b>Nginx</b></summary>

```nginx
server {
    listen 80;
    server_name jellytics.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host               $host;
        proxy_set_header   X-Real-IP          $remote_addr;
        proxy_set_header   X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto  $scheme;
    }
}
```

</details>

<details>
<summary><b>Caddy</b></summary>

```caddyfile
jellytics.yourdomain.com {
    reverse_proxy localhost:3000
}
```

</details>

<details>
<summary><b>Traefik</b></summary>

```yaml
labels:
  - "traefik.http.routers.jellytics.rule=Host(`jellytics.yourdomain.com`)"
  - "traefik.http.services.jellytics.loadbalancer.server.port=3000"
```

</details>

---

## 💾 Backing up your data

All of your stats, reviews, ratings, and watchlists live in a Docker volume called `jellytics-data`. Back it up. You'll thank yourself later.

**Back up:**

```bash
docker cp jellytics:/app/data ./jellytics-backup
```

**Restore:**

```bash
docker cp ./jellytics-backup jellytics:/app/data
docker compose restart
```

> 💡 The backup includes both your database and your cached artwork. Keep both together to avoid re-downloading all your posters on restore.

---

## 🔁 Updating

```bash
docker compose pull && docker compose up -d
```

Your data stays exactly where it is. Migrations run automatically. ✅

---

## 🛠️ Troubleshooting

<details>
<summary><b>🔴 Can't log in or sync never starts</b></summary>

Make sure your Jellyfin URL is correct and reachable from the machine running Jellytics. Use the local IP address (e.g. `http://192.168.1.10:8096`) rather than `localhost` if they're on different machines.

Check the logs for clues:

```bash
docker compose logs -f
```

</details>

<details>
<summary><b>🔴 Getting logged out every time the container restarts</b></summary>

You need a permanent `JWT_SECRET`. See [Keep sessions alive](#-keep-sessions-alive-across-restarts) above.

</details>

<details>
<summary><b>🔴 Port 80 is already taken</b></summary>

Change the port mapping in your compose file. See [Change the port](#-change-the-port) above.

</details>

<details>
<summary><b>🔴 Something looks wrong or data seems missing</b></summary>

Try a restart first:

```bash
docker compose restart
```

Check the container status:

```bash
docker compose ps
```

</details>

<details>
<summary><b>🔴 Nuclear option: wipe everything and start fresh</b></summary>

⚠️ **This deletes all your data permanently.**

```bash
docker compose down -v
docker compose up -d
```

</details>

---

## 🔨 Building from source

Prefer to build it yourself? No problem:

```bash
git clone https://github.com/icmpp/jellytics.git
cd jellytics
docker compose up -d --build
```

---

## 🤝 Contributing

Got a bug to report or a feature idea? [Open an issue](https://github.com/icmpp/jellytics/issues) on GitHub. Contributions are very welcome.

---

<div align="center">

Made with ❤️ for Jellyfin users, by Jellyfin users.

**⭐ Star the repo if Jellytics is useful to you, it helps more than you think!**

</div>
