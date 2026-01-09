# Backend Integration Guide

## API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password
POST /api/auth/logout
```

### Resources
```
GET    /api/resources           # List all
GET    /api/resources/:id       # Get one
POST   /api/resources           # Create (admin)
PUT    /api/resources/:id       # Update (admin)
DELETE /api/resources/:id       # Delete (admin)
```

### Bookings
```
GET    /api/bookings            # List (filter: userId, status, date)
POST   /api/bookings            # Create
PUT    /api/bookings/:id/status # Approve/reject (admin)
DELETE /api/bookings/:id        # Cancel
```

### Availability
```
GET /api/availability/:resourceId/:date
```

## Request/Response Examples

### Login
```json
// POST /api/auth/login
{ "email": "user@coet.edu", "password": "password123" }

// Response
{ "success": true, "data": { "id": 1, "name": "User", "role": "user" } }
```

### Create Booking
```json
// POST /api/bookings
{
  "resourceId": 1,
  "date": "2026-01-15",
  "slotId": 3,
  "purpose": "Cricket practice"
}

// Response
{ "success": true, "data": { "id": 10, "status": "pending" } }
```

## Error Codes
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 409: Conflict (e.g., slot already booked)
