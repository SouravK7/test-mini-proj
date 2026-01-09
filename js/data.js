/* =============================================
   MOCK DATA FOR DEVELOPMENT
   ============================================= */

const MockData = {
  // Users
  users: [
    { id: 1, name: 'Admin User', email: 'admin@coet.edu', password: 'admin123', role: 'admin', avatar: null },
    { id: 2, name: 'Dr. Sharma', email: 'faculty@coet.edu', password: 'faculty123', role: 'faculty', department: 'Sports Committee' },
    { id: 3, name: 'Rahul Kumar', email: 'user@coet.edu', password: 'user123', role: 'user', phone: '9876543210' },
    { id: 4, name: 'Community Member', email: 'public@gmail.com', password: 'public123', role: 'user', phone: '9123456780' }
  ],

  // Resources (Playgrounds)
  resources: [
    {
      id: 1,
      name: 'Main Cricket Ground',
      type: 'playground',
      subType: 'cricket',
      capacity: 200,
      location: 'North Campus',
      amenities: ['Pavilion', 'Changing Rooms', 'Floodlights', 'Scoreboard'],
      image: null,
      description: 'Full-size cricket ground with professional pitch and boundary. Suitable for matches and practice sessions.',
      status: 'available',
      rules: ['No metal spikes allowed', 'Prior booking required for floodlight use', 'Maximum 3-hour slots']
    },
    {
      id: 2,
      name: 'Football Field',
      type: 'playground',
      subType: 'football',
      capacity: 150,
      location: 'South Campus',
      amenities: ['Goal Posts', 'Changing Rooms', 'First Aid'],
      image: null,
      description: 'Standard football field with natural grass. Suitable for matches and training.',
      status: 'available',
      rules: ['Football boots only', 'No food/drinks on field']
    },
    {
      id: 3,
      name: 'Basketball Court',
      type: 'playground',
      subType: 'basketball',
      capacity: 50,
      location: 'Sports Complex',
      amenities: ['Indoor Court', 'Seating Gallery', 'Water Cooler'],
      image: null,
      description: 'Indoor basketball court with wooden flooring and proper markings.',
      status: 'available',
      rules: ['Indoor shoes only', 'Maximum 20 players at a time']
    },
    {
      id: 4,
      name: 'Tennis Courts',
      type: 'playground',
      subType: 'tennis',
      capacity: 20,
      location: 'East Block',
      amenities: ['2 Courts', 'Net Posts', 'Seating'],
      image: null,
      description: 'Two synthetic tennis courts available for singles and doubles matches.',
      status: 'maintenance',
      rules: ['Tennis shoes mandatory', 'Equipment not provided']
    },
    {
      id: 5,
      name: 'Athletics Track',
      type: 'playground',
      subType: 'athletics',
      capacity: 100,
      location: 'Main Stadium',
      amenities: ['400m Track', 'Long Jump Pit', 'Shot Put Area'],
      image: null,
      description: '400-meter synthetic running track with multiple lanes and field event facilities.',
      status: 'available',
      rules: ['Spikes allowed on track only', 'No cycling']
    }
  ],

  // Time Slots
  timeSlots: [
    { id: 1, label: '6:00 AM - 8:00 AM', start: '06:00', end: '08:00' },
    { id: 2, label: '8:00 AM - 10:00 AM', start: '08:00', end: '10:00' },
    { id: 3, label: '10:00 AM - 12:00 PM', start: '10:00', end: '12:00' },
    { id: 4, label: '2:00 PM - 4:00 PM', start: '14:00', end: '16:00' },
    { id: 5, label: '4:00 PM - 6:00 PM', start: '16:00', end: '18:00' },
    { id: 6, label: '6:00 PM - 8:00 PM', start: '18:00', end: '20:00' }
  ],

  // Bookings
  bookings: [
    {
      id: 1,
      resourceId: 1,
      userId: 3,
      date: '2026-01-10',
      slotId: 2,
      purpose: 'Cricket practice for inter-college tournament',
      status: 'approved',
      createdAt: '2026-01-05T10:30:00',
      approvedBy: 1,
      approvedAt: '2026-01-05T14:00:00'
    },
    {
      id: 2,
      resourceId: 2,
      userId: 3,
      date: '2026-01-12',
      slotId: 5,
      purpose: 'Football match - Department vs Department',
      status: 'pending',
      createdAt: '2026-01-07T09:15:00'
    },
    {
      id: 3,
      resourceId: 3,
      userId: 4,
      date: '2026-01-08',
      slotId: 4,
      purpose: 'Community basketball tournament',
      status: 'approved',
      createdAt: '2026-01-03T16:45:00',
      approvedBy: 1,
      approvedAt: '2026-01-04T09:00:00'
    },
    {
      id: 4,
      resourceId: 1,
      userId: 2,
      date: '2026-01-15',
      slotId: 3,
      purpose: 'Annual sports day practice',
      status: 'pending',
      createdAt: '2026-01-07T11:00:00'
    },
    {
      id: 5,
      resourceId: 5,
      userId: 3,
      date: '2026-01-05',
      slotId: 1,
      purpose: 'Morning running practice',
      status: 'completed',
      createdAt: '2026-01-01T08:00:00',
      approvedBy: 1,
      approvedAt: '2026-01-01T10:00:00'
    },
    {
      id: 6,
      resourceId: 2,
      userId: 4,
      date: '2026-01-06',
      slotId: 5,
      purpose: 'Weekend football friendly',
      status: 'rejected',
      createdAt: '2026-01-04T15:30:00',
      rejectedBy: 1,
      rejectedAt: '2026-01-05T09:00:00',
      rejectionReason: 'Ground under maintenance on that day'
    }
  ],

  // Usage Records
  usageRecords: [
    {
      id: 1,
      bookingId: 5,
      uploadedBy: 2,
      uploadedAt: '2026-01-05T09:30:00',
      remarks: 'Successful morning practice session. Track was in good condition.',
      issues: null,
      media: ['photo1.jpg', 'photo2.jpg']
    },
    {
      id: 2,
      bookingId: 3,
      uploadedBy: 2,
      uploadedAt: '2026-01-08T18:00:00',
      remarks: 'Community tournament completed. Minor cleanup required.',
      issues: 'One basketball net needs replacement',
      media: ['event_photo.jpg', 'event_video.mp4']
    }
  ],

  // Stats (for dashboard)
  stats: {
    totalResources: 5,
    bookingsToday: 2,
    pendingApprovals: 2,
    completedThisMonth: 8,
    totalUsers: 45,
    activeResources: 4
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}
