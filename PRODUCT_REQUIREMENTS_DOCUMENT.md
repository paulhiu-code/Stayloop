# Product Requirements Document (PRD)

## StayLoop - Consumer-First Vacation Rental Marketplace

**Version:** 1.0
**Last Updated:** October 13, 2025
**Document Owner:** Product Team
**Status:** In Development

---

## Executive Summary

StayLoop is a next-generation vacation rental marketplace for U.S. travelers booking entire homes, hotel rooms, cabins, and unique stays. The public website should emphasize guest search, verified inventory, transparent pricing, secure payments, and mobile trip management, while the host referral program lives in a separate partner experience.

### Vision Statement
To create a trusted short-term rental marketplace where guests can book exceptional stays with confidence and qualified hosts can grow through better economics, modern tools, and an optional partner program.

### Key Differentiators
- **Consumer-first booking experience** with modern search, verified stays, and clear pricing
- **10% host service fee** plus **5% guest service fee** shown transparently
- **Separate host partner program** with 3-level referral earnings (3%, 2%, 1%)
- **PMS integrations** for seamless property management
- **Instant book and request-to-book** capabilities with verified hosts

---

## 1. Product Overview

### 1.1 Problem Statement

**For Hosts:**
- High commission fees (15-20%) on existing platforms erode profit margins
- No incentive to help grow the platform beyond their own listings
- Limited earning potential restricted to owned properties
- Complex multi-platform management without proper tools

**For Guests:**
- Inconsistent quality and pricing across platforms
- Limited transparency in fee structures
- Fragmented booking experience

**For the Industry:**
- Centralized platforms extract excessive value
- Hosts lack ownership and long-term wealth building opportunities
- No incentive alignment between platform growth and host success

### 1.2 Solution

StayLoop addresses these challenges through:

1. **Lower Platform Fees**: 10% commission (vs. 15-20% industry standard)
2. **Multi-Level Referral System**: Hosts earn from network bookings 3 levels deep
3. **Integrated Property Management**: Native PMS integrations (OwnerRez, Guesty)
4. **Premium User Experience**: Modern, intuitive interface with instant booking
5. **Transparent Economics**: Clear pricing and earnings visibility

### 1.3 Target Users

**Primary Users:**
- **Existing Short-Term Rental Hosts** (1-10 properties)
  - Age: 30-55
  - Tech-savvy property managers
  - Active on multiple platforms
  - Revenue-focused, seeking optimization

**Secondary Users:**
- **Aspiring Hosts** (0 properties)
  - Age: 25-45
  - Interested in passive income
  - Looking to start with property management

**Tertiary Users:**
- **Property Management Companies**
  - Managing 10+ properties
  - Seeking lower fees and better tools
  - Value network effects

**Guest Persona:**
- **Travelers** seeking unique accommodations
- Age: 25-60
- Book 2-4 trips per year
- Value quality, location, and fair pricing

---

## 2. Core Features & Requirements

### 2.1 User Authentication & Profiles

#### Requirements
| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| AUTH-001 | Email/password authentication | P0 | ✅ Complete |
| AUTH-002 | OAuth social login (Google, Apple) | P1 | 📋 Planned |
| AUTH-003 | Two-factor authentication | P1 | 📋 Planned |
| AUTH-004 | Profile creation with avatar | P0 | ✅ Complete |
| AUTH-005 | User type selection (host/guest/both) | P0 | ✅ Complete |
| AUTH-006 | Email verification | P1 | 📋 Planned |
| AUTH-007 | Password reset flow | P0 | ✅ Complete |

#### User Stories
- **As a new user**, I want to sign up quickly with my email so I can start browsing properties
- **As a host**, I want to create a detailed profile showcasing my experience and properties
- **As a guest**, I want to see verified host badges to ensure credibility

---

### 2.2 Property Management

#### 2.2.1 Property Listing Creation

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PROP-001 | Multi-step property creation wizard | P0 | 📋 Planned |
| PROP-002 | Property type selection (house, apartment, condo, villa, etc.) | P0 | ✅ Complete |
| PROP-003 | Address & location mapping | P0 | ✅ Complete |
| PROP-004 | Bedroom/bathroom/guest count | P0 | ✅ Complete |
| PROP-005 | Pricing configuration (base, cleaning fee) | P0 | ✅ Complete |
| PROP-006 | Image upload (minimum 5 photos) | P0 | 📋 Planned |
| PROP-007 | Amenities selection (50+ options) | P0 | ✅ Complete |
| PROP-008 | House rules and policies | P0 | ✅ Complete |
| PROP-009 | Instant book toggle | P0 | ✅ Complete |
| PROP-010 | Minimum/maximum night requirements | P0 | ✅ Complete |

#### 2.2.2 Property Management Dashboard

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PROP-101 | View all owned properties | P0 | ✅ Complete |
| PROP-102 | Edit property details | P0 | 📋 Planned |
| PROP-103 | Activate/deactivate listings | P0 | ✅ Complete |
| PROP-104 | View property performance metrics | P1 | 📋 Planned |
| PROP-105 | Bulk property operations | P2 | 📋 Future |
| PROP-106 | Property duplication for similar listings | P2 | 📋 Future |

#### User Stories
- **As a host**, I want to list my property in under 10 minutes with a guided wizard
- **As a host**, I want to upload high-quality photos to showcase my property
- **As a host**, I want to easily update availability and pricing from one dashboard

---

### 2.3 Booking System

#### 2.3.1 Guest Booking Flow

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| BOOK-001 | Property search with filters | P0 | ✅ Complete |
| BOOK-002 | Interactive calendar date selection | P0 | 📋 Planned |
| BOOK-003 | Guest count validation | P0 | 📋 Planned |
| BOOK-004 | Price calculation with fees breakdown | P0 | 📋 Planned |
| BOOK-005 | Instant booking for qualified properties | P0 | ✅ Complete |
| BOOK-006 | Booking request workflow | P1 | 📋 Planned |
| BOOK-007 | Booking confirmation email | P0 | 📋 Planned |
| BOOK-008 | Booking cancellation policy | P0 | 📋 Planned |

#### 2.3.2 Host Booking Management

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| BOOK-101 | View incoming booking requests | P0 | ✅ Complete |
| BOOK-102 | Accept/decline booking requests | P0 | 📋 Planned |
| BOOK-103 | Booking calendar overview | P0 | 📋 Planned |
| BOOK-104 | Guest information access | P0 | ✅ Complete |
| BOOK-105 | Pre-arrival messaging | P1 | 📋 Planned |
| BOOK-106 | Check-in instructions management | P1 | 📋 Planned |

#### 2.3.3 Calendar & Availability

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| CAL-001 | Calendar view (month/week/day) | P0 | 📋 Planned |
| CAL-002 | Block dates for maintenance | P0 | 📋 Planned |
| CAL-003 | Custom pricing for specific dates | P0 | ✅ Complete |
| CAL-004 | Minimum night overrides | P1 | ✅ Complete |
| CAL-005 | Sync with external calendars (iCal) | P1 | 📋 Planned |
| CAL-006 | Automated availability updates | P0 | ✅ Complete |

#### User Stories
- **As a guest**, I want to see real-time availability so I can book my preferred dates
- **As a guest**, I want a transparent price breakdown before confirming my booking
- **As a host**, I want to manage my calendar easily and prevent double bookings
- **As a host**, I want to set seasonal pricing for peak travel periods

---

### 2.4 Payment System

#### Requirements

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PAY-001 | Stripe integration for payment processing | P0 | 🔄 Architecture Ready |
| PAY-002 | Guest payment capture at booking | P0 | 📋 Planned |
| PAY-003 | Host payout calculation (90% of booking) | P0 | ✅ Complete |
| PAY-004 | Automated payout scheduling | P0 | 📋 Planned |
| PAY-005 | Payment dispute handling | P1 | 📋 Planned |
| PAY-006 | Multiple payment methods | P1 | 📋 Planned |
| PAY-007 | Security deposit management | P1 | 📋 Planned |
| PAY-008 | Refund processing | P0 | 📋 Planned |
| PAY-009 | Invoice generation | P1 | 📋 Planned |
| PAY-010 | Tax documentation (1099 forms) | P2 | 📋 Future |

#### Payment Flow
1. Guest books → Payment held by Stripe
2. 24 hours after check-in → Host receives 90%
3. Platform retains 10% service fee
4. Referral commissions calculated and distributed

#### User Stories
- **As a guest**, I want to pay securely with my credit card
- **As a host**, I want to receive payouts automatically after guest check-in
- **As a host**, I want to see a clear breakdown of fees and earnings

---

### 2.5 Referral System (Core Differentiator)

#### 2.5.1 Referral Mechanics

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| REF-001 | Unique referral code generation | P0 | ✅ Complete |
| REF-002 | Referral code sharing (link/QR) | P0 | ✅ Complete |
| REF-003 | 3-level referral tracking | P0 | ✅ Complete |
| REF-004 | Commission calculation (3%, 2%, 1%) | P0 | ✅ Complete |
| REF-005 | Real-time earnings tracking | P0 | ✅ Complete |
| REF-006 | Referral network visualization | P1 | 📋 Planned |
| REF-007 | Referral leaderboard | P2 | 📋 Future |

#### 2.5.2 Commission Structure

**Level 1 (Direct Referrals):** 3% of booking revenue
- Host A refers Host B
- Host B earns $10,000 in bookings
- Host A earns $300 (3%)

**Level 2 (Second-Tier Referrals):** 2% of booking revenue
- Host A refers Host B
- Host B refers Host C
- Host C earns $10,000 in bookings
- Host A earns $200 (2%), Host B earns $300 (3%)

**Level 3 (Third-Tier Referrals):** 1% of booking revenue
- Host A → Host B → Host C → Host D
- Host D earns $10,000
- Host A earns $100 (1%), Host B earns $200 (2%), Host C earns $300 (3%)

#### 2.5.3 Referral Dashboard

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| REF-101 | Total referral earnings display | P0 | ✅ Complete |
| REF-102 | Pending vs. paid earnings | P0 | ✅ Complete |
| REF-103 | List of direct referrals | P0 | ✅ Complete |
| REF-104 | Network size metrics | P0 | ✅ Complete |
| REF-105 | Monthly earnings breakdown | P1 | 📋 Planned |
| REF-106 | Downloadable earnings reports | P1 | 📋 Planned |

#### User Stories
- **As a host**, I want to see my unique referral code prominently displayed
- **As a host**, I want to track how much I've earned from each referral level
- **As a host**, I want to visualize my referral network growth over time

---

### 2.6 Messaging System

#### Requirements

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| MSG-001 | In-app messaging between hosts and guests | P0 | ✅ Architecture Complete |
| MSG-002 | Conversation threading by booking | P0 | ✅ Complete |
| MSG-003 | Real-time message notifications | P0 | 📋 Planned |
| MSG-004 | Message read receipts | P1 | ✅ Complete |
| MSG-005 | Image/file attachments | P1 | 📋 Planned |
| MSG-006 | Automated booking messages | P1 | 📋 Planned |
| MSG-007 | Email notifications for new messages | P0 | 📋 Planned |
| MSG-008 | Message search and filtering | P2 | 📋 Future |
| MSG-009 | Template messages for common responses | P2 | 📋 Future |

#### User Stories
- **As a guest**, I want to ask the host questions before booking
- **As a host**, I want to receive check-in details and updates from guests
- **As a user**, I want to see all my conversations in one organized inbox

---

### 2.7 PMS Integrations

#### 2.7.1 OwnerRez Integration

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PMS-001 | OAuth authentication with OwnerRez | P0 | ✅ Complete |
| PMS-002 | Property sync from OwnerRez | P0 | ✅ Complete |
| PMS-003 | Booking sync (bi-directional) | P0 | ✅ Complete |
| PMS-004 | Availability calendar sync | P0 | ✅ Complete |
| PMS-005 | Webhook integration for real-time updates | P0 | ✅ Complete |
| PMS-006 | Pricing sync | P1 | ✅ Complete |
| PMS-007 | Guest information sync | P1 | 📋 Planned |
| PMS-008 | Review sync | P2 | 📋 Future |

#### 2.7.2 Guesty Integration

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PMS-101 | API key authentication with Guesty | P0 | ✅ Complete |
| PMS-102 | Listing sync from Guesty | P0 | ✅ Complete |
| PMS-103 | Reservation sync (bi-directional) | P0 | ✅ Complete |
| PMS-104 | Calendar management sync | P0 | ✅ Complete |
| PMS-105 | Webhook integration | P0 | ✅ Complete |
| PMS-106 | Multi-channel booking consolidation | P1 | ✅ Complete |
| PMS-107 | Automated pricing updates | P1 | 📋 Planned |

#### 2.7.3 PMS Management UI

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PMS-201 | Connect/disconnect PMS accounts | P0 | ✅ Complete |
| PMS-202 | Manual sync triggers | P0 | ✅ Complete |
| PMS-203 | Sync status and history logs | P0 | ✅ Complete |
| PMS-204 | Error notifications and retry | P0 | ✅ Complete |
| PMS-205 | Property mapping management | P1 | ✅ Complete |
| PMS-206 | Sync conflict resolution | P1 | 📋 Planned |
| PMS-207 | Automated sync scheduling | P1 | 📋 Planned |

#### User Stories
- **As a host**, I want to connect my OwnerRez account and automatically sync all properties
- **As a host**, I want real-time booking updates across all channels to prevent double bookings
- **As a host**, I want to see sync history and troubleshoot any errors

---

### 2.8 Search & Discovery

#### Requirements

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SRCH-001 | Location-based search | P0 | ✅ Complete |
| SRCH-002 | Date range filtering | P0 | 📋 Planned |
| SRCH-003 | Guest count filtering | P0 | 📋 Planned |
| SRCH-004 | Price range slider | P0 | 📋 Planned |
| SRCH-005 | Property type filters | P0 | ✅ Complete |
| SRCH-006 | Amenity filters (WiFi, pool, parking, etc.) | P0 | 📋 Planned |
| SRCH-007 | Instant book filter | P1 | ✅ Complete |
| SRCH-008 | Sort by price/rating/distance | P0 | 📋 Planned |
| SRCH-009 | Map view with markers | P1 | 📋 Planned |
| SRCH-010 | Saved searches | P2 | 📋 Future |

#### User Stories
- **As a guest**, I want to search for properties in my destination city
- **As a guest**, I want to filter by amenities important to me (pet-friendly, pool, etc.)
- **As a guest**, I want to see properties on a map to choose the best location

---

### 2.9 Reviews & Ratings

#### Requirements

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| REV-001 | 5-star rating system | P0 | ✅ Schema Complete |
| REV-002 | Written reviews from guests | P0 | ✅ Schema Complete |
| REV-003 | Multi-criteria ratings (cleanliness, communication, location, value) | P1 | ✅ Schema Complete |
| REV-004 | Host response to reviews | P1 | 📋 Planned |
| REV-005 | Review verification (only after completed stay) | P0 | 📋 Planned |
| REV-006 | Review moderation and flagging | P1 | 📋 Planned |
| REV-007 | Average rating calculation | P0 | 📋 Planned |
| REV-008 | Review display on property pages | P0 | 📋 Planned |

#### User Stories
- **As a guest**, I want to read reviews from previous guests before booking
- **As a host**, I want to respond to reviews to address concerns
- **As a guest**, I want to leave an honest review after my stay

---

## 3. Technical Architecture

### 3.1 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Authentication
- Supabase Edge Functions (Deno runtime)
- Row Level Security (RLS) for data access

**Payment Processing:**
- Stripe for payments and payouts

**Hosting & Infrastructure:**
- Vercel for frontend hosting
- Supabase cloud for backend
- Cloudflare for CDN and security

**External Integrations:**
- OwnerRez API
- Guesty Open API
- Stripe API
- Email service (SendGrid/Resend)

### 3.2 Database Schema

#### Core Tables

**Users & Authentication:**
- `auth.users` (Supabase managed)
- `profiles` - Extended user profile information
  - User type, referral code, verification status

**Properties:**
- `properties` - Property listings
  - Host, location, pricing, amenities, images
- `property_availability` - Calendar availability
  - Date-specific availability and pricing overrides

**Bookings:**
- `bookings` - Reservation records
  - Guest, host, dates, pricing, status, payment info

**Referrals:**
- `referral_earnings` - Referral commission tracking
  - Earner, referee, booking, level, amount, status

**Messaging:**
- `conversations` - Message threads
  - Participants, property, booking
- `messages` - Individual messages
  - Sender, content, timestamps, read status

**Reviews:**
- `reviews` - Guest reviews and ratings
  - Booking, property, ratings, comments

**PMS Integration:**
- `pms_connections` - PMS account connections
  - Provider, OAuth tokens, sync status
- `pms_property_mappings` - Property ID mappings
  - StayLoop ↔ PMS property relationships
- `pms_sync_logs` - Sync operation history
  - Type, status, records processed
- `pms_webhook_events` - Incoming webhook queue
  - Event type, payload, processing status

### 3.3 Security

**Authentication:**
- JWT-based authentication via Supabase
- Row Level Security (RLS) on all tables
- Secure session management

**Data Protection:**
- Encrypted OAuth tokens
- HTTPS everywhere
- PII encryption at rest
- GDPR compliant data handling

**Payment Security:**
- PCI DSS compliant via Stripe
- No card data stored locally
- Secure payment intent flow

---

## 4. User Experience (UX) Requirements

### 4.1 Design Principles

1. **Premium & Professional**: Modern, sophisticated design that builds trust
2. **Intuitive Navigation**: Users should accomplish tasks without training
3. **Performance**: Fast page loads, optimistic UI updates
4. **Responsive**: Seamless experience across desktop, tablet, mobile
5. **Accessibility**: WCAG 2.1 AA compliant

### 4.2 Key Flows

#### Guest Booking Flow
1. Landing page → Search
2. Browse results → Select property
3. View property details → Select dates
4. Review booking details → Payment
5. Confirmation → Pre-arrival messaging

**Target Completion Time:** < 5 minutes

#### Host Onboarding Flow
1. Sign up → Profile creation
2. Add first property → Property wizard
3. Set availability & pricing
4. Get referral code → Share
5. First booking → Payout setup

**Target Completion Time:** < 15 minutes

#### PMS Connection Flow
1. Dashboard → PMS Integrations
2. Select PMS provider → OAuth/API key
3. Authorize connection → Property mapping
4. Initial sync → Confirmation
5. Auto-sync enabled → Monitor logs

**Target Completion Time:** < 5 minutes

### 4.3 Mobile Experience

**Priority Features:**
- Property search and booking
- Messaging with hosts/guests
- Booking management
- Referral code sharing
- Sync status monitoring

**Native Apps:** Phase 2 (iOS and Android)

---

## 5. Business Requirements

### 5.1 Revenue Model

**Primary Revenue:**
- 10% commission on all bookings
- Paid to platform at time of booking

**Revenue Distribution:**
- 90% to property host
- 3% to Level 1 referrer (if applicable)
- 2% to Level 2 referrer (if applicable)
- 1% to Level 3 referrer (if applicable)
- Remainder to platform (4-10% depending on referral depth)

### 5.2 Growth Metrics

**Key Performance Indicators (KPIs):**
- Monthly Active Users (MAU)
- Properties listed
- Bookings completed
- Gross Booking Value (GBV)
- Referral network size
- Host retention rate
- Guest repeat booking rate
- PMS integration adoption

**Success Criteria (Year 1):**
- 1,000 active hosts
- 5,000 properties listed
- $5M in GBV
- 50% of hosts with active referral networks
- 30% of properties via PMS integration

### 5.3 Compliance & Legal

**Requirements:**
- Terms of Service
- Privacy Policy
- Cookie Policy
- Host Service Agreement
- Guest Booking Terms
- Refund and Cancellation Policies
- GDPR compliance
- California Consumer Privacy Act (CCPA) compliance
- Tax reporting (1099-K for hosts earning >$600)

---

## 6. Success Criteria

### 6.1 Product Launch (MVP)

**Must-Have Features:**
- ✅ User authentication and profiles
- ✅ Property listing creation
- 📋 Booking system with calendar
- 🔄 Payment processing (Stripe)
- ✅ Referral tracking and earnings
- ✅ Basic messaging
- ✅ PMS integrations (OwnerRez, Guesty)
- 📋 Search and filtering

**Launch Targets:**
- 100 beta hosts
- 500 properties listed
- 50 bookings in first month

### 6.2 Post-Launch (3 Months)

**Goals:**
- 500 active hosts
- 2,500 properties
- $500K GBV
- 20% host referral rate
- 25% PMS integration adoption

### 6.3 Growth Phase (6-12 Months)

**Goals:**
- 2,000 active hosts
- 10,000 properties
- $5M GBV
- 40% host referral rate
- 50% PMS integration adoption
- Mobile apps launched

---

## 7. Roadmap

### Phase 1: MVP (Months 1-3) ✅ In Progress
- User authentication
- Property listings
- Basic booking system
- Referral tracking
- PMS integrations
- Payment architecture

### Phase 2: Launch Preparation (Months 4-6)
- Complete booking calendar
- Payment processing (Stripe)
- Messaging system
- Search optimization
- Reviews and ratings
- Beta testing program

### Phase 3: Public Launch (Month 7)
- Marketing campaign
- Onboard first 100 hosts
- Monitor and optimize
- Customer support setup

### Phase 4: Growth (Months 8-12)
- Mobile applications
- Additional PMS integrations (Hostaway, Lodgify)
- Advanced analytics dashboard
- Automated pricing tools
- International expansion
- API for third-party integrations

### Phase 5: Scale (Year 2+)
- Enterprise features for property management companies
- White-label platform offering
- Marketplace for property services (cleaning, maintenance)
- Travel insurance integration
- Smart home device integrations

---

## 8. Risk Analysis

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| PMS API changes breaking sync | Medium | High | Versioned API clients, monitoring, fallback mechanisms |
| Payment processing failures | Low | Critical | Stripe redundancy, comprehensive error handling |
| Database performance issues | Medium | High | Optimized queries, caching, read replicas |
| Security breach | Low | Critical | Regular audits, penetration testing, bug bounty program |

### 8.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Low host adoption | Medium | Critical | Strong value proposition, aggressive early incentives |
| Regulatory compliance challenges | Medium | High | Legal review, compliance monitoring |
| Competitive response from Airbnb/Vrbo | High | Medium | Focus on differentiation, community building |
| Referral system exploitation | Low | Medium | Fraud detection, Terms of Service enforcement |

### 8.3 Market Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Economic downturn affecting travel | Medium | High | Diversified property types, flexible cancellation |
| Market saturation in key cities | Low | Medium | Geographic expansion, niche targeting |
| Changing regulations on short-term rentals | Medium | High | Market diversification, lobbying efforts |

---

## 9. Appendices

### Appendix A: Competitive Analysis

**Airbnb:**
- Strengths: Brand recognition, massive inventory, global reach
- Weaknesses: 15% host fee, 14.2% guest fee, no referral program
- Our Advantage: 10% fee, multi-level referrals, PMS integrations

**Vrbo (Expedia):**
- Strengths: Vacation focus, entire home listings
- Weaknesses: 15% host commission, limited innovation
- Our Advantage: Lower fees, network effects, modern tech stack

**Booking.com:**
- Strengths: Global distribution, hotel integration
- Weaknesses: 15%+ commission, complex platform
- Our Advantage: Specialized vacation rentals, host empowerment

### Appendix B: Market Opportunity

**Global Short-Term Rental Market:**
- Size: $87.1 billion (2024)
- CAGR: 11.2% (2025-2030)
- Number of hosts: 4+ million globally

**Target Market (Year 1):**
- United States: 1.5M hosts
- Focus: Mid-market properties ($100-300/night)
- Geographic: Top 25 US metro areas

### Appendix C: Pricing Strategy

**Host Pricing:**
- 10% platform commission
- Free to list
- No subscription fees
- Instant payout option (1% fee)

**Guest Pricing:**
- Transparent fee structure
- No guest service fee (absorbed in pricing)
- Competitive with market rates

### Appendix D: Go-to-Market Strategy

**Phase 1: Seed (Months 1-3)**
- Target: 100 beta hosts
- Strategy: Direct outreach to hosts on other platforms
- Incentive: Waived fees for first 3 months

**Phase 2: Growth (Months 4-6)**
- Target: 500 hosts
- Strategy: Referral program activation, content marketing
- Channels: Facebook groups, Reddit, property management forums

**Phase 3: Scale (Months 7-12)**
- Target: 2,000 hosts
- Strategy: Paid acquisition, partnerships with PMS providers
- Channels: Google Ads, influencer partnerships, industry events

---

## 10. Glossary

- **GBV**: Gross Booking Value - Total value of bookings processed
- **MAU**: Monthly Active Users
- **PMS**: Property Management System
- **RLS**: Row Level Security
- **MLM**: Multi-Level Marketing (referral structure)
- **Instant Book**: Property available for immediate booking without host approval
- **Service Fee**: Platform commission taken from booking value
- **Payout**: Payment to host after guest stay

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Oct 13, 2025 | Product Team | Initial PRD creation |

---

**Approval Signatures:**

Product Lead: _________________ Date: _______

Engineering Lead: _________________ Date: _______

Business Lead: _________________ Date: _______

---

*This document is confidential and proprietary to StayLoop. Unauthorized distribution is prohibited.*
