# Setup Instructions

## Quick Start

1. **Extract/Clone** the project folder
2. **Open** `public/public-calendar.html` in browser (no login needed)
3. For authenticated access: Open `index.html` and login

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@coet.edu | admin123 |
| Faculty | faculty@coet.edu | faculty123 |
| User | user@coet.edu | user123 |

## Project Structure

```
Resource Management Project/
├── index.html          # Login page
├── css/                # Stylesheets
├── js/                 # JavaScript files
├── pages/              # Authenticated pages
├── public/             # Public access pages
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
