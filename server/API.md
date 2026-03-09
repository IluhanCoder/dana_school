# Authentication API Documentation

## Endpoints

### 1. Register User
**POST** `/api/auth/register`

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "65a7f4c8d3e2a1b2c3d4e5f6",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

---

### 2. Login User
**POST** `/api/auth/login`

Request body:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "65a7f4c8d3e2a1b2c3d4e5f6",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Note:** The `refreshToken` is set automatically in an httpOnly cookie.

---

### 3. Refresh Access Token
**POST** `/api/auth/refresh`

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 4. Logout User
**POST** `/api/auth/logout`

Response (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 5. Get All Users (Protected)
**GET** `/api/users`

Headers:
```
Authorization: Bearer <accessToken>
```

Response (200):
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a7f4c8d3e2a1b2c3d4e5f6",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-26T10:00:00Z",
      "updatedAt": "2024-01-26T10:00:00Z"
    }
  ]
}
```

---

### 6. Get User by ID (Protected)
**GET** `/api/users/:id`

Headers:
```
Authorization: Bearer <accessToken>
```

Response (200):
```json
{
  "success": true,
  "data": {
    "id": "65a7f4c8d3e2a1b2c3d4e5f6",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-26T10:00:00Z"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Description of the error"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized access"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

---

## Token Details

- **Access Token**: Expires in 15 minutes
- **Refresh Token**: Expires in 7 days (stored in httpOnly cookie)

## Architecture

- **Controller**: Handles HTTP requests and responses
- **Service**: Contains business logic
- **Router**: Defines API routes
- **Model**: MongoDB schema definition
- **Middleware**: Authorization middleware for protected routes
