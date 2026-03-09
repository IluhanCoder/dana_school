# Token Testing Guide

## How Tokens Work in This Application

### Token Storage
- **Access Token**: Stored in `localStorage` under key `accessToken`
- **Refresh Token**: Stored in httpOnly cookie (automatically managed by browser)

### Token Flow

#### 1. Registration/Login
```
User submits credentials
         ↓
Server validates and returns access token + refresh token
         ↓
Client stores access token in localStorage
Client stores refresh token in httpOnly cookie
         ↓
User is redirected to dashboard
```

#### 2. Protected API Requests
```
Client makes request to protected endpoint
         ↓
axios interceptor reads access token from localStorage
         ↓
Adds Authorization header: "Bearer {token}"
         ↓
Server receives and validates token
         ↓
Returns data or 401 if token expired
```

#### 3. Token Refresh (on 401)
```
Access token expires (after 15 minutes)
         ↓
API returns 401 Unauthorized
         ↓
Response interceptor catches error
         ↓
Sends refresh request with httpOnly cookie
         ↓
Server validates refresh token
         ↓
Returns new access token
         ↓
New token stored in localStorage
         ↓
Original request retried with new token
```

#### 4. Logout
```
User clicks Logout
         ↓
Client calls POST /api/auth/logout
         ↓
Server clears httpOnly cookie
         ↓
Client removes access token from localStorage
         ↓
User redirected to /auth
```

## Testing Tokens

### Test Case 1: Login & Access Protected Route
1. Go to http://localhost:5174
2. Click "Sign In"
3. Enter credentials:
   - Email: `test@example.com`
   - Password: `password123`
4. Click "Login"
5. Should see Dashboard with users list
6. Open DevTools → Application → LocalStorage
7. Verify `accessToken` is stored

### Test Case 2: Automatic Token in API Requests
1. Login successfully
2. Open DevTools → Network
3. On Dashboard, look at GET request to `/api/users`
4. Check Request Headers → Authorization
5. Should see: `Authorization: Bearer eyJhbGciOiJIUzI1NiI...`

### Test Case 3: Protected Route Access
1. Manually navigate to http://localhost:5174/dashboard
2. If logged in → should see Dashboard
3. If NOT logged in → should redirect to /auth
4. Try in browser console: `localStorage.getItem('accessToken')`
   - If logged in → returns token string
   - If not logged in → returns null

### Test Case 4: Logout
1. Login successfully
2. Click "Logout" button
3. Check localStorage - `accessToken` should be removed
4. Verify redirect to /auth
5. Try accessing /dashboard → should redirect to /auth

### Test Case 5: Token Refresh (Optional - for testing)
The token refresh happens automatically. To test:
1. Login and note the token in localStorage
2. Wait 15+ minutes (or manually delete token and let refresh trigger)
3. Make a request to protected endpoint
4. Check if new token appears in localStorage

## API Configuration

### Environment Variables
- `VITE_API_URL`: Base URL for API (default: `http://localhost:5000/api`)

Create `.env` file:
```
VITE_API_URL=http://localhost:5000/api
```

## File Structure for Token Management

```
client/src/
├── api/
│   └── api.ts              # Axios instance with interceptors
├── auth/
│   ├── auth-page.tsx       # Login/Register UI
│   └── auth-service.ts     # Auth logic (login, register, logout, token refresh)
├── components/
│   ├── Header.tsx          # Navigation (shows based on auth status)
│   └── ProtectedRoute.tsx  # Wrapper for protected routes
├── types/
│   ├── api.types.ts        # API response types
│   └── auth.types.ts       # Auth-related types
└── router.tsx              # Route definitions with protected routes
```

## Key Features

✅ Automatic token injection in all API requests
✅ Automatic token refresh on 401 response
✅ Protected routes (redirect to /auth if not authenticated)
✅ Logout clears all authentication data
✅ Token stored securely (localStorage for access, httpOnly cookie for refresh)
✅ Error handling for token-related issues

## Debugging

### Check if user is authenticated:
```javascript
// In browser console
localStorage.getItem('accessToken')  // null or token string
```

### Manually trigger token refresh:
```javascript
// If you want to test the refresh logic manually
fetch('http://localhost:5000/api/auth/refresh', {
  method: 'POST',
  credentials: 'include'  // Include cookies
})
.then(r => r.json())
.then(d => console.log(d))
```

### Check server logs:
- Backend should log "✓ MongoDB connected successfully"
- All API requests should be logged

## Common Issues

**Issue**: "401 Unauthorized" after login
- Check if access token is saved in localStorage
- Verify server is running on port 5000
- Check if MongoDB is connected

**Issue**: Token not sent with requests
- Verify axios interceptor is reading from localStorage
- Check browser console for errors
- Make sure VITE_API_URL is correct

**Issue**: Redirect loop on /auth
- Check localStorage - if empty, make sure you're logged in
- Try logout and login again
- Clear all localStorage and cookies, try again
