# Deploy on Render

## 1) What this project deploys

- Backend API as Render Web Service from `server/`
- Frontend as Render Static Site from `client/`

A ready-to-use config file is included: `render.yaml`.

## 2) Create services from Blueprint

1. Push code to GitHub.
2. In Render: **New** -> **Blueprint**.
3. Select this repository.
4. Render will detect `render.yaml` and create:
   - `school-project-api`
   - `school-project-client`

## 3) Set required environment variables

### Backend (`school-project-api`)

Required:
- `MONGO_URI` = your MongoDB connection string
- `JWT_SECRET` = strong random string
- `JWT_REFRESH_SECRET` = another strong random string
- `CLIENT_URL` = URL of your frontend Render static site

Optional:
- `CLIENT_URLS` = comma-separated extra allowed origins (for example preview URLs)

Already set by `render.yaml`:
- `NODE_ENV=production`
- `PORT=10000`

### Frontend (`school-project-client`)

Required:
- `VITE_API_URL` = your backend URL with `/api`, for example:
  - `https://school-project-api.onrender.com/api`

## 4) Important auth/cookie behavior (already prepared)

In production, refresh-token cookie is configured as:
- `httpOnly: true`
- `secure: true`
- `sameSite: none`

This is required when frontend and backend are on different Render domains.

## 5) Redeploy order

1. Deploy backend first.
2. Copy backend URL and set frontend `VITE_API_URL`.
3. Set backend `CLIENT_URL` to frontend URL.
4. Redeploy both services.

## 6) Quick verification checklist

- Open frontend URL.
- Register/login works.
- No CORS errors in browser console.
- Requests go to `https://<api-service>.onrender.com/api/...`.
- Refresh token works (after access token expires, app stays logged in).

## 7) Local fallback defaults

- Client fallback API: `http://localhost:5001/api`
- Server fallback client URL: `http://localhost:5173`

These defaults are only for local development.
