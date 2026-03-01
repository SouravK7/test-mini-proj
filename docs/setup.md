# Setup Instructions

## Running the Frontend

1. Simply drag and drop `index.html` into your web browser OR
2. **Open** `index.html` in browser (no login needed for Public Calendar)
3. For authenticated access: Navigate to the `login.html` link (or click "Login to Book")

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@coet.edu | admin123 |
| Faculty | faculty@coet.edu | faculty123 |
| User | user@coet.edu | user123 |

## Project Structure

```
Resource Management Project/
├── index.html          # Public Calendar (entry point)
├── login.html          # Login page
├── css/                # Stylesheets
├── js/                 # JavaScript files
├── pages/              # Authenticated pages
├── public/             
└── docs/               # Documentation
```

## Features by Role

### Public (No Login)
- View playground availability
- Submit booking requests

### Normal User
- Login/logout
- View resources
- Request bookings
- View booking history

### Faculty
- All user features
- Upload usage records (photos/videos)
- Add remarks/issues

### Admin
- Dashboard with stats
- Approve/reject bookings
- View reports
- Manage resources

## Browser Requirements
- Modern browser (Chrome, Firefox, Edge, Safari)
- JavaScript enabled
- LocalStorage enabled

## Connecting to Backend

Replace mock calls in `js/api.js` with real `fetch()` calls:

```javascript
// Current (mock)
async getResources() {
  await this.delay();
  return { success: true, data: MockData.resources };
}

// Backend (real)
async getResources() {
  const response = await fetch('/api/resources');
  return response.json();
}
```

See `docs/backend-integration.md` for API specs.
