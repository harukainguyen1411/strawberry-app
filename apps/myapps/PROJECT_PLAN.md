# MyApps - Project Plan & Requirements

## Project Overview

**MyApps** is a multi-app platform that showcases various application ideas. The first app to be built is **Read Tracker**, a comprehensive reading time tracking application.

---

## 1. Requirements Breakdown

### 1.1 MyApps Platform (Main Website)

#### Core Features:
- **Home Page**
  - Display a grid/list of all available apps
  - Each app card shows: app name, description, thumbnail, and "Open App" button
  - Navigation to individual app pages
  - Responsive design for mobile and desktop

#### Technical Requirements:
- Single Page Application (SPA) structure
- Routing to handle multiple apps
- Shared layout/header for consistency
- Easy to add new apps in the future

---

### 1.2 Read Tracker App

#### 1.2.1 Reading Session Tracking
- **Add Reading Session**
  - Form to log: date, start time, end time (or duration), book being read
  - Manual entry or timer-based entry
  - Validation to ensure logical time entries
  - Display total reading time for the day

#### 1.2.2 Dashboard & Metrics
- **Overview Dashboard**
  - Today's reading time
  - Current week's total reading time
  - Current month's total reading time
  - Current year's total reading time
  - Average reading time per day (weekly/monthly/yearly)
  - Reading streak (consecutive days with reading)
  - Visual charts/graphs (line chart for trends, bar chart for daily breakdown)

#### 1.2.3 Books Management
- **Books Tab**
  - List of all books (currently reading, completed, want to read)
  - Add new book: title, author, cover image (optional), start date
  - Mark book as completed with completion date
  - Edit book details
  - Delete book
  - View reading sessions per book
  - Filter books by status (reading/completed/want to read)

#### 1.2.4 Reading Goals
- **Goal Setting**
  - Set daily reading goal (minutes/hours)
  - Set weekly reading goal
  - Set monthly reading goal
  - Set yearly reading goal
  - Progress indicators showing goal completion percentage
  - Visual progress bars/charts

#### 1.2.5 Reminders
- **Daily Reminders**
  - Set reminder time (e.g., 8:00 AM daily)
  - Enable/disable reminders
  - Browser notification support (with permission)
  - Custom reminder message

#### 1.2.6 Authentication & Data Persistence
- **Google Login**
  - Firebase Authentication with Google provider
  - User profile display
  - Logout functionality
  - All data synced to user's account
  - Data persists across devices

---

## 2. Technology Stack

### 2.1 Frontend Framework
- **Vue 3** (Composition API)
  - Modern, reactive framework
  - Excellent performance
  - Great developer experience
  - Free and open-source

### 2.2 Build Tool & Development
- **Vite**
  - Fast build tool
  - Hot Module Replacement (HMR)
  - Optimized production builds
  - Free

### 2.3 Routing
- **Vue Router 4**
  - Client-side routing
  - Nested routes for apps
  - Free

### 2.4 State Management
- **Pinia** (Vue 3 recommended state management)
  - Simple and intuitive
  - TypeScript support
  - DevTools integration
  - Free

### 2.5 Backend & Database
- **Firebase**
  - **Firebase Authentication**: Google login
  - **Firestore Database**: Store reading sessions, books, goals, user preferences
  - **Firebase Hosting**: Deploy the website (free tier available)
  - Free tier includes:
    - 50K reads/day
    - 20K writes/day
    - 20K deletes/day
    - 1GB storage

### 2.6 UI Framework
- **Vuetify 3** or **Quasar** or **PrimeVue**
  - Pre-built components
  - Material Design or modern UI
  - Responsive layouts
  - Free (open-source)

**Alternative (Lighter):**
- **Tailwind CSS** + **Headless UI** or **Radix Vue**
  - Utility-first CSS
  - Customizable components
  - Free

### 2.7 Charts & Visualization
- **Chart.js** with **vue-chartjs**
  - Simple, responsive charts
  - Free and open-source

**Alternative:**
- **ApexCharts** with **vue3-apexcharts**
  - More advanced charts
  - Free for non-commercial use

### 2.8 Date/Time Handling
- **date-fns** or **Day.js**
  - Lightweight date utilities
  - Free

### 2.9 Form Validation
- **VeeValidate** with **Yup**
  - Form validation library
  - Free

### 2.10 Icons
- **Material Design Icons** or **Heroicons**
  - Free icon sets

### 2.11 Notifications
- **Browser Notification API** (native)
  - No additional library needed
  - Free

---

## 3. Architecture Overview

### 3.1 Project Structure
```
myapp/
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── router/
│   │   └── index.js
│   ├── stores/
│   │   ├── auth.js
│   │   ├── readingSessions.js
│   │   ├── books.js
│   │   └── goals.js
│   ├── views/
│   │   ├── Home.vue (MyApps home)
│   │   └── ReadTracker/
│   │       ├── Dashboard.vue
│   │       ├── ReadingSessions.vue
│   │       ├── Books.vue
│   │       ├── Goals.vue
│   │       └── Settings.vue
│   ├── components/
│   │   ├── common/
│   │   └── ReadTracker/
│   ├── composables/
│   ├── utils/
│   └── firebase/
│       ├── config.js
│       ├── auth.js
│       └── firestore.js
├── public/
├── package.json
└── vite.config.js
```

### 3.2 Firestore Database Structure
```
users/{userId}/
  ├── readingSessions/
  │   └── {sessionId}/
  │       ├── date: timestamp
  │       ├── startTime: timestamp
  │       ├── endTime: timestamp
  │       ├── duration: number (minutes)
  │       ├── bookId: string (reference)
  │       └── createdAt: timestamp
  ├── books/
  │   └── {bookId}/
  │       ├── title: string
  │       ├── author: string
  │       ├── coverImage: string (optional)
  │       ├── status: string (reading/completed/wantToRead)
  │       ├── startDate: timestamp
  │       ├── completedDate: timestamp (optional)
  │       └── createdAt: timestamp
  ├── goals/
  │   └── {goalId}/
  │       ├── type: string (daily/weekly/monthly/yearly)
  │       ├── targetMinutes: number
  │       ├── year: number (for yearly)
  │       ├── month: number (for monthly)
  │       └── week: number (for weekly)
  └── settings/
      ├── reminderEnabled: boolean
      ├── reminderTime: string (HH:mm)
      └── notificationPermission: string
```

---

## 4. Milestones

### Milestone 1: Project Setup & Foundation (Week 1)
- [ ] Initialize Vue 3 project with Vite
- [ ] Set up Vue Router with basic routes
- [ ] Set up Pinia for state management
- [ ] Configure Firebase project
- [ ] Set up Firebase Authentication
- [ ] Create basic layout components (Header, Navigation)
- [ ] Create MyApps home page with app listing
- [ ] Set up basic routing to Read Tracker app

**Deliverable:** Working skeleton with navigation and Firebase connection

---

### Milestone 2: Authentication & Core UI (Week 1-2)
- [ ] Implement Google login with Firebase Auth
- [ ] Create authentication guard for protected routes
- [ ] Build user profile component
- [ ] Set up UI framework (Vuetify/Quasar/Tailwind)
- [ ] Create responsive layout for Read Tracker
- [ ] Design and implement navigation menu

**Deliverable:** Users can log in and see the app structure

---

### Milestone 3: Reading Sessions (Week 2)
- [ ] Create reading session form (add/edit)
- [ ] Implement session list view with filtering
- [ ] Connect to Firestore to save/retrieve sessions
- [ ] Add validation for time entries
- [ ] Display today's reading time
- [ ] Create session history view

**Deliverable:** Users can log reading sessions and see their history

---

### Milestone 4: Books Management (Week 2-3)
- [ ] Create books list view
- [ ] Implement add book form
- [ ] Add edit/delete book functionality
- [ ] Implement book status management (reading/completed)
- [ ] Link reading sessions to books
- [ ] Display reading sessions per book
- [ ] Add book cover image upload (Firebase Storage - free tier)

**Deliverable:** Complete book management system

---

### Milestone 5: Dashboard & Metrics (Week 3)
- [ ] Create dashboard layout
- [ ] Calculate and display daily/weekly/monthly/yearly totals
- [ ] Calculate average reading time
- [ ] Implement reading streak calculation
- [ ] Add charts for reading trends (Chart.js/ApexCharts)
- [ ] Create visual progress indicators
- [ ] Add date range filters

**Deliverable:** Comprehensive dashboard with visual metrics

---

### Milestone 6: Reading Goals (Week 3-4)
- [ ] Create goal setting interface
- [ ] Implement goal CRUD operations
- [ ] Calculate goal progress
- [ ] Display progress bars/charts
- [ ] Add goal completion notifications
- [ ] Show goal status on dashboard

**Deliverable:** Full goal tracking system

---

### Milestone 7 (postponed): Reminders & Notifications (Week 4)
- [ ] Create reminder settings page
- [ ] Implement browser notification permission request
- [ ] Set up daily reminder logic
- [ ] Create notification service
- [ ] Add reminder toggle functionality
- [ ] Test notification delivery

**Deliverable:** Working reminder system with browser notifications

---

### Milestone 8: Polish & Optimization (Week 4-5)
- [ ] Add loading states and error handling
- [ ] Implement data caching for better performance
- [ ] Optimize Firestore queries
- [ ] Add responsive design improvements, optimized for mobile screen
- [ ] Implement offline support (optional - PWA)
- [ ] Add data export functionality (optional)
- [ ] Performance optimization
- [ ] Cross-browser testing

**Deliverable:** Production-ready application

---

### Milestone 9: Deployment (Week 5)
- [ ] Set up Firebase Hosting
- [ ] Configure custom domain (optional)
- [ ] Deploy application
- [ ] Test production build
- [ ] Set up analytics (Firebase Analytics - free)
- [ ] Create user documentation

**Deliverable:** Live, deployed application

---

## 5. Free Tier Limits & Considerations

### Firebase Free Tier:
- **Firestore**: 50K reads/day, 20K writes/day, 20K deletes/day, 1GB storage
- **Authentication**: Unlimited
- **Hosting**: 10GB storage, 360MB/day transfer
- **Storage**: 5GB storage, 1GB/day download

### Optimization Strategies:
- Implement pagination for reading sessions list
- Cache frequently accessed data
- Use Firestore indexes efficiently
- Limit real-time listeners where possible
- Compress images before upload

---

## 6. Additional Features (Future Enhancements)

- Reading statistics (pages read, books completed count)
- Reading calendar view
- Export data to CSV/JSON
- Reading notes/journal per book
- Book recommendations
- Reading challenges
- Social features (share progress)
- Dark mode
- Multiple language support
- Mobile app (using Capacitor + Vue)

---

## 7. Development Workflow

1. **Local Development**
   - Run `npm run dev` for development server
   - Use Firebase Emulator Suite for local testing (optional)

2. **Version Control**
   - Use Git for version control
   - Create feature branches for each milestone

3. **Testing**
   - Manual testing for each feature
   - Test authentication flows
   - Test data persistence
   - Test responsive design

4. **Deployment**
   - Build production bundle: `npm run build`
   - Deploy to Firebase Hosting: `firebase deploy`

---

## 8. Next Steps

1. Review and approve this plan
2. Set up development environment
3. Initialize project with Vue 3 + Vite
4. Create Firebase project
5. Begin Milestone 1 implementation

---

## Notes

- All recommended tools are free and open-source
- Firebase free tier should be sufficient for personal use and initial testing
- Vue 3 Composition API provides better code organization and reusability
- Consider using TypeScript for better type safety (optional)
- Regular backups of Firestore data recommended
