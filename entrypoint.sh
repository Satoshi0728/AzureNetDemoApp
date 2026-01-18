#!/bin/sh
set -e

mkdir -p /var/run/sshd || true

info() {
	echo "[info] $*" >&2
}

warn() {
	echo "[warn] $*" >&2
}

# Ensure host keys exist. If this fails, keep the app running (SSH console will be unavailable).
if command -v ssh-keygen >/dev/null 2>&1; then
	if ! ssh-keygen -A; then
		warn "ssh-keygen failed; continuing without SSH."
	fi
else
	warn "ssh-keygen not found; continuing without SSH."
fi

# Start SSH daemon for Azure App Service portal console (port 2222).
# Best-effort: if sshd fails, the application should still start.
if [ -x /usr/sbin/sshd ]; then
	if /usr/sbin/sshd -t -f /etc/ssh/sshd_config; then
		if ! /usr/sbin/sshd -f /etc/ssh/sshd_config; then
			warn "sshd failed to start; continuing without SSH."
		else
			info "sshd started (port 2222)."
		fi
	else
		warn "sshd_config validation failed; continuing without SSH."
	fi
else
	warn "sshd binary not found; continuing without SSH."
fi

if [ "$#" -eq 0 ]; then
	set -- node backend/src/server.js
fi

exec "$@"
