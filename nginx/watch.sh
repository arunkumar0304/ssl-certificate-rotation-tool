#!/bin/sh
# Reload nginx whenever the certificate file changes (replaces the 'reload service' step of the Ansible path).
nginx
last=$(md5sum /etc/nginx/certs/fullchain.pem)
while true; do
  sleep 3
  now=$(md5sum /etc/nginx/certs/fullchain.pem)
  if [ "$now" != "$last" ]; then nginx -s reload; last="$now"; fi
done
