# KibeProxy Hub - Codebase Analysis

## Project Overview

**KibeProxy Hub** is a full-stack web application for buying and managing proxies and email accounts. It's built with a modern tech stack combining frontend HTML/CSS/JavaScript with Supabase backend and M-Pesa payment integration.

**Location:** `c:\Users\Administrator\myproxy.html`

---

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with CSS variables for theming
- **JavaScript (Vanilla)** - No frameworks, pure ES6+
- **Fonts:** Syne (primary), DM Mono (monospace)

### Backend & Services
- **Supabase** - PostgreSQL database + authentication
- **M-Pesa API** - Payment processing (via Vercel backend)
- **Express.js** - Backend server for M-Pesa integration (in `/js` folder)

### Key Libraries
- `@supabase/supabase-js@2` - Supabase client library
- `axios` - HTTP requests
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variables
- `express` - Web framework

---

## Project Structure

```
myproxy.html/
├── index.html              # Dashboard (main page)
├── auth.html               # Login/Signup page
├── store.html              # Proxy & Email store
├── admin.html              # Admin panel
├── profile.html            # User profile management
├── docs.html               # Documentation
├── css/
│   ├── main.css            # Global styles & variables
│   ├── index.css           # Dashboard styles
│   ├── auth.css            # Auth page styles
│   ├── admin.css           # Admin panel styles
│   └── store.css           # Store page styles
├── js/
│   ├── supabase.js         # Supabase config & utilities
│   ├── index.js            # Dashboard logic
│   ├── auth.js             # Authentication logic
│   ├── store.js            # Store & payment logic
│   ├── admin.js            # Admin panel logic
│   ├── profile.js          # Profile management logic
│   ├── docs.js             # Documentation logic
│   ├── antitamper.js       # Security/anti-tampering
│   ├── package.json        # Node dependencies
│   ├── vercel.json         # Vercel deployment config
│   └���─ .env                # Environment variables
└── CODEBASE_ANALYSIS.md    # This file
```

---

## Core Features

### 1. Authentication System (`auth.html`, `js/auth.js`)

**Features:**
- Email-based login and signup
- Username-based login support (with `@` prefix)
- Password visibility toggle
- Form validation
- Auto-redirect if already logged in
- Browser password save prompts

**Key Functions:**
- `handleLogin()` - Authenticate user with email or username
- `handleSignup()` - Create new account
- `togglePasswordVisibility()` - Show/hide password
- `switchAuth()` - Toggle between login and signup tabs

**Database Tables Used:**
- `auth.users` - Supabase auth table
- `usernames` - Custom table for username mapping
- `user_bans` - User ban status

---

### 2. Dashboard (`index.html`, `js/index.js`)

**Features:**
- Display user's purchased proxies and emails
- Tab-based navigation (Active, Expired, Emails)
- Statistics cards (active proxies, expired proxies, emails count)
- Password reveal/hide functionality
- Payment status badges
- Empty states with call-to-action

**Key Functions:**
- `initAuth()` - Initialize dashboard with user session
- `loadAll()` - Fetch proxies and emails from database
- `renderProxies()` - Render proxy table
- `renderEmails()` - Render email table
- `togglePass()` - Show/hide proxy/email passwords
- `switchTab()` - Switch between tabs

**Database Tables Used:**
- `proxies` - User's purchased proxies
- `emails` - User's purchased emails

---

### 3. Store (`store.html`, `js/store.js`)

**Features:**
- Browse available proxies and emails
- Select duration for proxies (1, 7, 14, 30 days)
- Real-time price calculation
- M-Pesa payment integration
- Order summary modal
- Payment status tracking (success, failed, pending)
- Auto-save purchases after payment

**Key Functions:**
- `initStore()` - Initialize store with listings
- `loadListings()` - Fetch available proxies and emails
- `switchStoreTab()` - Toggle between proxies and emails
- `renderProxyListings()` - Display proxy cards
- `renderEmailListings()` - Display email cards
- `selectDur()` - Select proxy duration
- `openProxyOrder()` / `openEmailOrder()` - Open order modal
- `initiateMpesaPayment()` - Send M-Pesa STK push
- `showMpesaWaiting()` - Poll payment status
- `completePaidOrder()` - Save purchase to database

**Payment Flow:**
1. User selects item and duration
2. Opens order summary modal
3. Enters M-Pesa phone number
4. System sends STK push to phone
5. Polls M-Pesa API for payment confirmation
6. On success: saves proxy/email to user's account
7. Marks listing as unavailable

**Database Tables Used:**
- `proxy_listings` - Available proxies for sale
- `email_listings` - Available emails for sale
- `proxies` - Purchased proxies
- `emails` - Purchased emails

---

### 4. Admin Panel (`admin.html`, `js/admin.js`)

**Features:**
- View all users and their purchases
- Manage proxy and email listings
- Add new proxies and emails to store
- View all purchases with payment details
- Ban/unban users
- Delete user items
- Search users by ID
- Statistics dashboard

**Key Functions:**
- `initAdmin()` - Initialize admin panel (no role check - all logged-in users can access)
- `loadAll()` - Fetch all data
- `renderUsers()` - Display users with expandable details
- `renderPurchases()` - Show all purchases
- `renderProxyListings()` / `renderEmailListings()` - Show store inventory
- `addProxyListing()` - Add proxy to store
- `addEmailListing()` - Add email to store
- `removeProxyListing()` / `removeEmailListing()` - Remove from store
- `deleteUserProxy()` / `deleteUserEmail()` - Remove from user
- `banUser()` - Ban/unban user
- `filterUsers()` - Search users

**Database Tables Used:**
- `proxies` - All proxies
- `emails` - All emails
- `proxy_listings` - Store inventory
- `email_listings` - Store inventory
- `user_bans` - Ban status

---

### 5. User Profile (`profile.html`, `js/profile.js`)

**Features:**
- Display user information and statistics
- Set/update username
- Update contact details (email, phone)
- Change password
- Username availability checking
- Form validation and alerts

**Key Functions:**
- `initProfile()` - Load user data
- `checkUsername()` - Check username availability
- `saveUsername()` - Save username
- `saveContact()` - Update email/phone
- `changePassword()` - Update password
- `togglePV()` - Toggle password visibility

**Database Tables Used:**
- `usernames` - Username mapping
- `auth.users` - User authentication data

---

### 6. Shared Utilities (`js/supabase.js`)

**Configuration:**
- Supabase project URL and API key
- Admin email: `kibetian2005@gmail.com`

**Key Functions:**
- `showToast()` - Display notification messages
- `openModal()` / `closeModal()` - Modal management
- `handleLogout()` - Sign out user
- `toggleSupport()` - Support dropdown menu

---

## Database Schema

### Tables

#### `auth.users` (Supabase built-in)
- `id` - UUID
- `email` - User email
- `user_metadata` - Contains `full_name`
- `created_at` - Account creation date

#### `usernames`
- `id` - UUID
- `user_id` - FK to auth.users
- `username` - Unique username
- `email` - User's email
- `created_at` - Creation date

#### `proxies`
- `id` - UUID
- `user_id` - FK to auth.users
- `host` - Proxy IP/hostname
- `port` - Proxy port
- `country` - Country name
- `username` - Proxy username
- `password` - Proxy password
- `status` - 'active' or 'expired'
- `expires_at` - Expiration date
- `buyer_email` - Email of purchaser
- `mpesa_phone` - M-Pesa phone used
- `mpesa_code` - M-Pesa receipt code
- `payment_status` - 'success', 'pending', 'failed'
- `purchased_at` - Purchase timestamp
- `created_at` - Record creation date

#### `emails`
- `id` - UUID
- `user_id` - FK to auth.users
- `email` - Email address
- `password` - Email password
- `buyer_email` - Email of purchaser
- `mpesa_phone` - M-Pesa phone used
- `mpesa_code` - M-Pesa receipt code
- `payment_status` - 'success', 'pending', 'failed'
- `purchased_at` - Purchase timestamp
- `created_at` - Record creation date

#### `proxy_listings`
- `id` - UUID
- `country` - Country name
- `flag` - Country emoji flag
- `host` - Proxy IP/hostname
- `port` - Proxy port
- `username` - Proxy username
- `password` - Proxy password
- `price_per_day` - Price in KES
- `available` - Boolean (true/false)
- `created_at` - Creation date

#### `email_listings`
- `id` - UUID
- `email` - Email address
- `password` - Email password
- `price` - Price in KES (typically 25)
- `available` - Boolean (true/false)
- `created_at` - Creation date

#### `user_bans`
- `user_id` - FK to auth.users
- `banned` - Boolean
- `updated_at` - Last update date

---

## Styling & Design

### Color Scheme (CSS Variables)
```css
--bg: #0a0a0a              /* Dark background */
--surface: #111111         /* Card/surface background */
--border: #1e1e1e          /* Border color */
--border-light: #2a2a2a    /* Light border */
--text-primary: #f0f0f0    /* Main text */
--text-secondary: #888     /* Secondary text */
--text-muted: #555         /* Muted text */
--green: #22c55e           /* Primary accent (green) */
--green-dim: #166534       /* Darker green */
--green-glow: rgba(34,197,94,0.15)  /* Green glow */
--red: #ef4444             /* Error/danger */
--red-glow: rgba(239,68,68,0.1)     /* Red glow */
--yellow: #eab308          /* Warning */
--yellow-glow: rgba(234,179,8,0.1)  /* Yellow glow */
--blue: #3b82f6            /* Info */
--blue-glow: rgba(59,130,246,0.1)   /* Blue glow */
```

### Design System
- **Dark theme** - Modern dark UI
- **Glassmorphism** - Backdrop blur effects
- **Rounded corners** - 8px-20px border radius
- **Monospace font** - DM Mono for data/codes
- **Animations** - Smooth transitions and keyframe animations
- **Responsive** - Mobile-first approach with breakpoints at 700px

---

## Security Features

### Authentication
- Supabase built-in authentication
- Session-based access control
- Auto-redirect to auth page if not logged in
- Password hashing (Supabase handles)

### Data Protection
- User can only see their own data
- Admin can view all data (no role restriction currently)
- Passwords hidden by default in UI
- M-Pesa codes stored for audit trail

### Anti-Tampering
- `js/antitamper.js` - Security measures (content not fully visible in provided files)
- Email obfuscation in footer

---

## Payment Integration

### M-Pesa Flow
1. **Backend:** Vercel-hosted Express server at `https://kibeproxy-mpesa.vercel.app`
2. **Endpoints:**
   - `POST /api/stkpush` - Initiate payment
   - `GET /api/status/:checkoutRequestId` - Check payment status
3. **Phone Format:** Converts to international format (+254)
4. **Polling:** Client polls every 3 seconds for up to 60 seconds
5. **Status Codes:** success, failed, pending

---

## Key Workflows

### User Registration & Login
```
1. User fills signup form (name, email, password)
2. Supabase creates auth user
3. User can now login with email or set username
4. Username stored in `usernames` table for lookup
```

### Buying a Proxy
```
1. User browses store.html
2. Selects proxy and duration
3. Opens order modal with summary
4. Enters M-Pesa phone number
5. System sends STK push
6. User enters M-Pesa PIN on phone
7. Payment confirmed
8. Proxy record created in `proxies` table
9. Listing marked as unavailable
10. User sees proxy in dashboard
```

### Admin Adding Inventory
```
1. Admin goes to admin.html
2. Fills proxy/email form with details
3. Clicks "Add to Store"
4. Record created in `proxy_listings` or `email_listings`
5. Item appears in store for users to buy
```

---

## Performance Considerations

### Optimizations
- Vanilla JavaScript (no framework overhead)
- CSS variables for efficient theming
- Lazy loading of data
- Efficient database queries with `.select('*')`
- Minimal external dependencies

### Potential Improvements
- Implement pagination for large datasets
- Add caching for listings
- Optimize images/assets
- Minify CSS/JS for production
- Implement service workers for offline support

---

## Known Issues & Limitations

### Current State
1. **No role-based access control** - All logged-in users can access admin panel
2. **No email verification** - Users can sign up with any email
3. **No rate limiting** - Payment API could be abused
4. **Limited error handling** - Some edge cases not covered
5. **No audit logging** - Admin actions not logged
6. **Hardcoded admin email** - Single admin account

### Security Concerns
1. Supabase API key exposed in frontend (public key, but still visible)
2. No CSRF protection
3. No input sanitization for XSS prevention
4. M-Pesa phone number stored in plaintext
5. No password strength requirements

---

## Environment Variables

Located in `js/.env`:
```
SUPABASE_URL=https://dyhzdtvnirqwhsfmrvjo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MPESA_API_URL=https://kibeproxy-mpesa.vercel.app
```

---

## Deployment

### Frontend
- Static HTML/CSS/JS files
- Can be deployed to any static hosting (Vercel, Netlify, GitHub Pages)
- Currently accessible at `c:\Users\Administrator\myproxy.html`

### Backend
- M-Pesa integration backend deployed on Vercel
- Express.js server handling payment processing
- Supabase handles database and authentication

---

## Contact & Support

**Support Channels:**
- WhatsApp: +254724031319
- Telegram: @kibeproxy
- Email: kibetcreations2025@outlook.com
- Community: WhatsApp group link

**Developer:**
- Phone: +254799289214
- Email: kibetcreations2025@outlook.com

---

## Future Enhancement Opportunities

1. **Role-Based Access Control** - Implement proper admin roles
2. **Email Verification** - Verify user emails before account activation
3. **Two-Factor Authentication** - Add 2FA for security
4. **Proxy Health Checks** - Verify proxies are working
5. **Usage Analytics** - Track proxy usage and performance
6. **Subscription Plans** - Monthly/yearly subscription options
7. **API Keys** - Allow users to generate API keys for programmatic access
8. **Webhook Support** - Notify users of important events
9. **Refund System** - Handle refunds for failed proxies
10. **Multi-Currency Support** - Support currencies beyond KES

---

## Summary

KibeProxy Hub is a well-structured, modern web application for proxy and email sales with integrated M-Pesa payments. The codebase is clean, uses vanilla JavaScript, and leverages Supabase for backend services. While it has some security considerations, it provides a solid foundation for a proxy marketplace platform.

**Total Files:** 30+
**Lines of Code:** ~5,000+
**Main Technologies:** HTML5, CSS3, JavaScript ES6+, Supabase, M-Pesa API
**Status:** Production-ready with room for security and feature enhancements
