# Milestone 3: Console MVP

## Overview
This milestone implements a basic console application for managing agent runs using Next.js with TypeScript and the App Router.

## Ports
- Forgejo: 3000
- Console: 3001
- Agent Runner: 8000
- Taiga: 9000

## Features Implemented

### Agent Runner API Endpoints
1. `GET /runs` - Lists all runs, newest first
2. `GET /runs/{run_id}/events` - Lists events for a run, ascending by (created_at, ID)
3. `POST /runs/{run_id}/directive` - Creates a directive event (JSON body: `{"text": "..."}`)
4. `POST /runs/{run_id}/{action}` - Restricted to pause|resume|stop actions only
5. `POST /runs` - Create a new run (JSON body)

### Console Application
1. Home page that lists Projects and Runs
2. Run detail page showing run information and events
3. Controls for Pause/Resume/Stop actions
4. Form to submit directives
5. Environment variables for API URLs, polling intervals, and timeouts
6. Hardened polling hooks with adaptive intervals and visibility awareness

## Directory Structure
