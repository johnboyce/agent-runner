# Deployment Guide

## Server-Sent Events (SSE) Configuration

The agent-runner console uses Server-Sent Events (SSE) for real-time event streaming. When deploying behind a reverse proxy like nginx, you need to configure it properly to support long-lived SSE connections.

### Nginx Configuration for SSE

Add the following configuration to your nginx server block for the SSE endpoint:

```nginx
# Disable buffering for SSE endpoints
location /runs/ {
    proxy_pass http://backend:8000;
    
    # Only apply SSE-specific settings to the /events/stream path
    location ~ ^/runs/[0-9]+/events/stream$ {
        proxy_pass http://backend:8000;
        
        # Disable buffering for SSE
        proxy_buffering off;
        
        # Increase read timeout for long-lived connections
        proxy_read_timeout 3600s;
        
        # Disable gzip compression for SSE
        gzip off;
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Required for SSE
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        
        # Cache control
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Complete Example

Here's a complete nginx configuration example:

```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3001;
}

server {
    listen 80;
    server_name agent-runner.example.com;

    # Frontend (Next.js)
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API (FastAPI) - Regular endpoints
    location /runs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE streaming endpoints
        location ~ ^/runs/[0-9]+/events/stream$ {
            proxy_pass http://backend;
            
            # SSE-specific configuration
            proxy_buffering off;
            proxy_read_timeout 3600s;
            gzip off;
            
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection '';
            proxy_http_version 1.1;
            chunked_transfer_encoding off;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Other backend endpoints
    location /projects {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /worker {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Key Configuration Options Explained

- **`proxy_buffering off`**: Disables nginx buffering so SSE events are sent immediately to the client
- **`proxy_read_timeout 3600s`**: Increases the timeout to 1 hour (adjust as needed for your use case)
- **`gzip off`**: Disables gzip compression which can interfere with SSE streaming
- **`proxy_set_header Connection ''`**: Clears the Connection header to prevent connection closure
- **`proxy_http_version 1.1`**: Uses HTTP/1.1 which is required for persistent connections
- **`chunked_transfer_encoding off`**: Disables chunked encoding to ensure proper SSE delivery

### Fallback Behavior

The agent-runner console includes automatic fallback to REST polling if:
- SSE connection fails
- EventSource is not supported by the browser
- Network configuration blocks SSE

This ensures the application continues to work even if SSE cannot be established.

### Troubleshooting

**Events not appearing in real-time:**
- Check nginx error logs: `tail -f /var/log/nginx/error.log`
- Verify `proxy_buffering off` is set for the SSE endpoint
- Ensure firewall allows long-lived connections

**Connection drops after 60 seconds:**
- Increase `proxy_read_timeout` to a higher value
- Check if there are other timeouts in your infrastructure (load balancers, CDN)

**Browser shows "Reconnecting...":**
- Check if the backend is running and accessible
- Verify CORS settings allow EventSource connections
- Check browser console for error messages

### Testing SSE

You can test the SSE endpoint directly with curl:

```bash
# Test SSE connection (should stream events)
curl -N http://localhost:8000/runs/1/events/stream

# Test with Last-Event-ID header (resume from specific event)
curl -N -H "Last-Event-ID: 5" http://localhost:8000/runs/1/events/stream

# Test with after_id query parameter
curl -N http://localhost:8000/runs/1/events/stream?after_id=5
```

You should see events in SSE format:
```
id: 1
event: RUN_CREATED
data: {"id": 1, "run_id": 1, "type": "RUN_CREATED", "payload": "...", "created_at": "..."}

: keepalive

id: 2
event: AGENT_THINKING
data: {"id": 2, "run_id": 1, "type": "AGENT_THINKING", "payload": "...", "created_at": "..."}
```

### Production Considerations

1. **Load Balancing**: If using multiple backend servers, ensure sticky sessions or use a shared event store
2. **SSL/TLS**: SSE works with HTTPS, just ensure your SSL termination is configured properly
3. **Connection Limits**: SSE maintains one connection per client per run - monitor your connection pool sizes
4. **Monitoring**: Track SSE connection count and duration in your monitoring system

### Docker Compose Example

If using Docker Compose with nginx:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
      - frontend

  backend:
    build: ./agent-runner
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./db/platform.db

  frontend:
    build: ./console
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_AGENT_RUNNER_URL=http://nginx/api
```

For more information, see the [nginx SSE documentation](http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering).
