# COET Ground Booking System

> **Note**: This project is intended for **reference purposes** and for **reviewing the User Interface (UI)** design. It serves as a visual demonstration and is not a fully functional production application.

A web-based application for managing college playground bookings, designed to streamline the reservation process for students, faculty, and administrators.

## 🌟 Features

- **Role-Based Access Control**:
  - **Admin**: Manage bookings, approve/reject requests, and view usage reports.
  - **Faculty**: Book resources and upload usage records (photos/videos).
  - **User**: View availability and request bookings.
- **Resource Management**: Real-time availability checking and conflict-free booking.
- **Usage Tracking**: Faculty can submit evidence of usage after their slot.
- **Responsive Design**: Works seamlessly across desktop and mobile devices.

## 🚀 Getting Started

This is a static web application built with vanilla HTML, CSS, and JavaScript. You can run it directly in your browser or serve it using a local development server.

### Running Locally

1. **Clone or Download** the repository.
2. **Open** the project folder.
3. **Launch** the application:
   - Simply open `index.html` in your web browser.
   - OR use a local server (e.g., Live Server in VS Code, `python3 -m http.server`, or `npx serve`).

### Demo Credentials

You can use the following credentials to test different user roles:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@coet.edu` | `admin123` |
| **Faculty** | `faculty@coet.edu` | `faculty123` |
| **User** | `user@coet.edu` | `user123` |

## 📂 Project Structure

- `css/` - Global and component-specific styles.
- `js/` - Application logic (auth, data management, notifications).
- `pages/` - Application views (Dashboard, Bookings, Resources).
- `public/` - Publicly accessible pages (e.g., Public Calendar).
- `docs/` - Documentation and user guides.

## 📚 Documentation

For detailed instructions on how to use the system, check out the [User Guide](docs/user-guide.md).

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage (for data persistence in this demo version)
