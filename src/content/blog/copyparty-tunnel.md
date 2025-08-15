---
title: 'copyparty-tunnel'
description: 'Run a copyparty instance and expose it using a cloudflare tunnel'
pubDate: 'August 15 2025'
heroImage: '/blog/copyparty.svg'
---

# copyparty + Cloudflare Tunnel

I recently discovered [copyparty](https://github.com/9001/copyparty), and it's a remarkably powerful file server. It has a humble presentation and a simple setup, yet it's packed with an incredible number of features.

To easily run `copyparty` on my local Mac Mini and share files outside my network, I used the recommended strategy from the official README: a Cloudflare Tunnel. This approach lets me expose `copyparty` to the internet securely without revealing my home IP address or dealing with router port forwarding.

However, I saw a few ways to improve this setup:

- **Portability:** I wanted something I could pull and run instantly on any new machine.
- **Simplicity:** I needed a single, simple daemon to manage both `copyparty` and the Cloudflare Tunnel together.

This led me to containerize the entire setup using Docker. Below is a complete guide on how to do it yourself.

**Note:** You can find the up-to-date code for this guide in this repository: [vilos92/copyparty-tunnel](https://github.com/Vilos92/copyparty-tunnel). You can also skip building the image yourself and pull the pre-built version from Docker Hub: [greglinscheid/copyparty-tunnel](https://hub.docker.com/r/greglinscheid/copyparty-tunnel).

---

## Step 1: Prepare Your Cloudflare Tunnel 🚇

First, you'll need to set up a Cloudflare Tunnel and get a token to authenticate the connection.

### Get a Cloudflare Tunnel Token

The best way to get started is to follow the official [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/).

A few key things to remember:

- **Be consistent with your port.** The tunnel must be configured to point to the same port that you specify in your `copyparty` configuration and `Dockerfile`. In this guide, we use port **`3923`**.
- **Secure your token.** You'll receive a token after creating the tunnel. Keep it somewhere safe, as you will need to provide it to the Docker container at runtime.

### (Optional) Install the `cloudflared` Client

To test your tunnel before running it inside Docker, you can install the `cloudflared` client on your local machine. This is not a prerequisite for the final setup, but it's useful for validation. You can find installation instructions [here](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).

---

## Step 2: Create the Docker Image 🐳

Next, we'll define a Docker image that packages `copyparty`, `cloudflared`, and a startup script.

### The `Dockerfile`

This `Dockerfile` sets up an Alpine Linux environment, installs all necessary dependencies, and prepares the container to run our services.

```dockerfile
FROM alpine:latest

RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    curl \
    ca-certificates \
    ffmpeg \
    imagemagick \
    && rm -rf /var/cache/apk/*

# Install copyparty
RUN pip3 install --break-system-packages copyparty

# Install cloudflared
RUN curl -L [https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64) -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared

# Create app directory
WORKDIR /app

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENTRYPOINT ["/app/start.sh"]
```

Here's a breakdown of what the `Dockerfile` does:

- Uses the lightweight `alpine:latest` image as a base.
- Installs essential packages like Python, plus `ffmpeg` and `imagemagick` for generating media thumbnails.
- Installs `copyparty` via `pip`.
- Downloads the `cloudflared` binary, makes it executable, and places it in the system's `PATH`.
- Copies in a `start.sh` script to launch the services.

### The `start.sh` Script

This simple script is the container's entrypoint. It starts `copyparty` in the background and then launches `cloudflared` in the foreground.

```bash
#!/bin/bash

copyparty -c /app/copyparty.conf &

cloudflared tunnel run --token "$COPYPARTY_CLOUDFLARED_TOKEN"
```

- `copyparty -c /app/copyparty.conf &` starts the `copyparty` server using a configuration file and puts the process in the background.
- `cloudflared tunnel run ...` starts the tunnel, connecting to Cloudflare using the token passed via an environment variable.

### Build the Image

With the `Dockerfile` and `start.sh` script in the same directory, run the following command to build your Docker image:

```bash
docker build -t greglinscheid/copyparty-tunnel:latest .
```

---

## Step 3: Configure and Run the Container 🚀

Finally, we need to create a configuration file for `copyparty` and run the container.

### The `copyparty.conf` File

You must provide a configuration file to define users, mount shared folders (volumes), and set permissions. Here is an example to get you started.

```ini
# ===================================================================
#   Global settings
# ===================================================================
[global]
  p: 3923
  qr
  xff-hdr: cf-connecting-ip

# ===================================================================
#   User Accounts
# ===================================================================
[accounts]
  # username: password
  # IMPORTANT: You should change this default password!
  admin: hunter2
  friend: gatherer3

# ===================================================================
#   Shared Folders (Volumes)
# ===================================================================

# This is the main share, available at the website's root (/).
# Only the admin can access the full volume.
[/]
  /Volumes/Elements
  accs:
    r: admin

# Friends are allowed to access my media.
# Admin can already access this due to root access.
[/Local Vault/Media]
  /Volumes/Elements/Local Vault/Media
  accs:
    r: friend

# Friends are allowed to access my concerts.
# Admin can already access this due to root access.
[/Cloud Vault/Concerts]
  /Volumes/Elements/Cloud Vault/media/concerts - official
  accs:
    r: friend

# Friends are allowed to access my Mac Vault.
# Admin can already access this due to root access.
[/Mac Vault]
  /Volumes/Mac Vault
  accs:
    r: greg, friend

# Admins and friends can upload files. Only admins can read/write/delete.
[/Upload Vault]
  /Volumes/Elements/Upload Vault
  accs:
    w: admin, friend
    rwmd: admin
  flags:
    e2d
    nodupe
    # Disable media parsing and thumbnails for security.
    d2t, dthumb

# This is a folder that anyone can see.
# The 'r: *' setting correctly gives access to "friend" and un-logged in users.
[/Public Vault]
  /Volumes/Elements/Public Vault
  accs:
    r: *
  flags:
    e2dsa
```

**Note:** The port `3923` is set under `[global]`. Ensure this matches the port configured in your Cloudflare Tunnel dashboard. For more advanced options, refer to the official [copyparty README](https://github.com/9001/copyparty).

### Run the Container

With your Docker image built and your `copyparty.conf` file ready, you can now run the container.

```bash
docker run -d \
  --name gcopyparty \
  -p 3923:3923 \
  -u $(id -u) \
  # Map your configuration file (required)
  -v "$(pwd)/copyparty.conf:/app/copyparty.conf:ro" \
  \
  # Map your data volumes (examples below, change them!)
  -v "/path/on/your/computer/to/music:/data/music" \
  -v "/path/on/your/computer/to/documents:/data/docs" \
  \
  # Pass in the Cloudflare token (required)
  -e COPYPARTY_CLOUDFLARED_TOKEN="$COPYPARTY_CLOUDFLARED_TOKEN" \
  --restart unless-stopped \
  greglinscheid/copyparty-tunnel:latest
```

Let's break down the `docker run` command:

- `-p 3923:3923`: Maps the container's port to your host machine.
- `-u $(id -u)`: Runs the container as your current user to avoid file permission issues.
- `-v "$(pwd)/copyparty.conf:/app/copyparty.conf:ro"`: Mounts your local configuration file into the container as **read-only**. This is **required**.
- `-v "/path/on/your/computer/..."`: Mounts your local directories into the container so `copyparty` can serve them. **Change these paths to match your own.**
- `-e COPYPARTY_CLOUDFLARED_TOKEN=...`: Passes your Cloudflare Tunnel token to the container as an environment variable. This is **required**.
- `--restart unless-stopped`: Ensures the container restarts automatically if it crashes or the system reboots.

That's it! Your `copyparty` instance is now running and securely exposed to the internet through your Cloudflare Tunnel. Enjoy your new portable and secure file-sharing setup!

![greg's copyparty](/blog/copyparty-2025-08-15-4.36.53 PM.png)
