#!/usr/bin/env bash
set -euo pipefail

# Secrets are only present in this step, never in npm/Composer build steps.
for name in SSH_HOST SSH_USER SSH_PORT SSH_PRIVATE_KEY SSH_KNOWN_HOSTS PUBLIC_WEB_ROOT PRIVATE_BACKEND_ROOT; do
  [[ -n "${!name:-}" ]] || { echo "Missing deployment setting: $name"; exit 1; }
done
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid SSH host.'; exit 1; }
[[ "$SSH_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || { echo 'Invalid SSH user.'; exit 1; }
[[ "$SSH_PORT" =~ ^[0-9]{1,5}$ ]] && (( 10#$SSH_PORT > 0 && 10#$SSH_PORT < 65536 )) || { echo 'Invalid SSH port.'; exit 1; }
for directory in "$PUBLIC_WEB_ROOT" "$PRIVATE_BACKEND_ROOT"; do
  [[ "$directory" =~ ^/home/[a-zA-Z0-9_./-]+$ && "$directory" != *'/../'* && "$directory" != *'/..' ]] || { echo 'Deployment paths must be absolute safe home-directory paths.'; exit 1; }
  [[ "$directory" == "/home/$SSH_USER/"* ]] || { echo 'Deployment paths must belong to this hosting account.'; exit 1; }
done
[[ "$PRIVATE_BACKEND_ROOT" != "$PUBLIC_WEB_ROOT" && "$PRIVATE_BACKEND_ROOT" != "$PUBLIC_WEB_ROOT/"* ]] || { echo 'The backend must stay outside the public root.'; exit 1; }
[[ -f dist/index.html && -f server/vendor/autoload.php ]] || { echo 'Build/dependencies are missing.'; exit 1; }

umask 077
key_file="$(mktemp)"
hosts_file="$(mktemp)"
ssh_config="$(mktemp)"
trap 'rm -f "$key_file" "$hosts_file" "$ssh_config"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$key_file"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$hosts_file"
ssh-keygen -y -f "$key_file" > /dev/null
cat > "$ssh_config" <<EOF
Host namecheap-deploy
  HostName $SSH_HOST
  User $SSH_USER
  Port $SSH_PORT
  IdentityFile $key_file
  UserKnownHostsFile $hosts_file
  StrictHostKeyChecking yes
  IdentitiesOnly yes
  BatchMode yes
  ConnectTimeout 15
EOF

# Paths are validated above; remote realpath checks reject public/private symlinks
# pointing outside the intended home. The existing private config is required.
ssh -F "$ssh_config" namecheap-deploy "bash -s -- $PUBLIC_WEB_ROOT $PRIVATE_BACKEND_ROOT" <<'REMOTE'
set -euo pipefail
public_root="$(realpath -e "$1")"
private_root="$(realpath -e "$2")"
home_root="$(realpath -e "$HOME")"
[[ "$public_root" == "$home_root/"* && "$private_root" == "$home_root/"* ]] || { echo 'A deployment directory resolves outside this hosting account.'; exit 1; }
[[ "$private_root" != "$public_root" && "$private_root" != "$public_root/"* ]] || { echo 'Private backend resolves inside the public root.'; exit 1; }
[[ -f "$private_root/config.php" ]] || { echo 'Upload the private config.php before enabling deployment.'; exit 1; }
mkdir -p "$private_root/storage"
chmod 700 "$private_root/storage"
chmod 600 "$private_root/config.php"
command -v rsync > /dev/null || { echo 'rsync is required on the hosting account.'; exit 1; }
REMOTE

# No --delete: preserve older hashed assets for cached pages. Preserve config,
# runtime anti-spam state and hosting-managed PHP/HTTPS directives.
rsync -az --delay-updates --exclude='config.php' --exclude='storage/' \
  -e "ssh -F $ssh_config" server/ "namecheap-deploy:$PRIVATE_BACKEND_ROOT/"
rsync -az --ignore-existing --include='*/' --include='.htaccess' --include='.user.ini' --exclude='*' \
  -e "ssh -F $ssh_config" dist/ "namecheap-deploy:$PUBLIC_WEB_ROOT/"
rsync -az --delay-updates --exclude='index.html' --exclude='.htaccess' --exclude='.user.ini' \
  -e "ssh -F $ssh_config" dist/ "namecheap-deploy:$PUBLIC_WEB_ROOT/"
# Publish the entry point after its assets are available.
rsync -az --delay-updates -e "ssh -F $ssh_config" dist/index.html "namecheap-deploy:$PUBLIC_WEB_ROOT/index.html"
echo 'Deployment finished. Server-side config and storage were preserved.'
