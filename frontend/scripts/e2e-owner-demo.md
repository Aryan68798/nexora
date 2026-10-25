# Nexora End-to-End Owner Flow Demo Guide

This document provides step-by-step verification instructions for the Phase F4 Space Owner workflow on the Nexora platform.

---

## Prerequisites

1. Ensure the backend and frontend development servers are running:
   - Backend: `http://localhost:5001`
   - Frontend: `http://localhost:5173`
2. Ensure you have an authenticated user with the `OWNER` role (or sign up with the "Property Steward / Owner" role option on `/signup`).

---

## 1. Property Management & Wizard (`/owner/properties`)

### Step 1.1: Managed Properties Overview
1. Navigate to `/owner/properties` in the browser.
2. Verify the page displays:
   - Page header "Managed Properties" with quick action button "List New Property".
   - Search bar and status filters ("All", "Active", "Draft", "Archived").
   - Responsive cards displaying cover photo, title, location, rentable space count, and status badges.
   - ContextMenu (long-press on touch or right-click / triple-dot button on desktop) for quick status changes and navigation.

### Step 1.2: 4-Step Listing Wizard (`/owner/properties/new`)
1. Click "List New Property" or navigate to `/owner/properties/new`.
2. Observe the Stepper indicator: Basic Details -> Location -> Features & Rules -> Photos & Review.
3. Test draft auto-save and recovery:
   - Type a property title, e.g. "Villa Serenade", and select Property Type "VILLA".
   - Refresh the browser page.
   - Verify that the title and values persist with the "Draft restored" notification banner.
4. Step through the wizard:
   - **Step 1 (Basic Details)**: Enter title and description. Click "Next: Location".
   - **Step 2 (Location)**: Enter Address Line 1, City (e.g. "Bengaluru"), State ("Karnataka"), and a 6-digit postal code (e.g. "560001").
   - **Step 3 (Category & Rules)**: Select Category and enter optional house rules. Click "Next: Photos & Review".
   - **Step 4 (Photos & Review)**:
     - Drag & drop or pick image files (JPEG, PNG, or WebP under 5MB).
     - Test validation: upload an oversized file (>5MB) or SVG; verify inline warning appears.
     - Set a cover image and test reordering thumbnails.
     - Click "Create & List Property".
5. Observe sequential upload progression and automatic redirect to the newly created property detail page.

---

## 2. Space Creation & Photo Management

### Step 2.1: Add a Space (`/owner/properties/:id/spaces/new`)
1. From the property detail page, click "Add Rentable Space".
2. Fill in space attributes:
   - Space Name (e.g. "Private Garden Suite")
   - Space Type (e.g. "GARDEN")
   - Guest Capacity (e.g. 6)
   - Price per unit using `MoneyInput`: type "2500" and select "DAY". Verify the rupee sign ₹ prefix and decimal formatting.
   - Note the GST tax disclosure note.
3. Stage photo uploads with cover photo selection.
4. Click "Save & Finish" or "Save & Add Another Space".
5. Verify the new space appears under the "Rentable Spaces" list on the property detail page.

### Step 2.2: Edit Space Details (`/owner/spaces/:id/edit`)
1. In the spaces list, click "Edit" on a space.
2. Update the capacity or price. Note the disclosure: "Existing bookings keep their booked price."
3. Save changes and verify the updated attributes on the property detail page.

---

## 3. Booking Requests Management (`/owner/bookings`)

### Step 3.1: Booking Inquiries & Filtering
1. Navigate to `/owner/bookings` (or click "Bookings" in the sidebar/bottom nav).
2. If pending bookings exist, note the badge counter on the sidebar navigation item (refreshes periodically).
3. Test status filter tabs:
   - "Pending" (requests awaiting owner confirmation or decline)
   - "Confirmed" (accepted reservations)
   - "Completed" (concluded stays)
   - "Cancelled" / "Rejected" (declined or cancelled bookings)
   - "All Requests"
4. Verify guest privacy invariants:
   - Guest display name and contact phone number are shown.
   - Verify that guest email address is strictly NOT exposed anywhere in the card, list, or DOM.

### Step 3.2: Confirm & Reject Gestures
1. For a `PENDING` booking card:
   - Test inline buttons: click "Confirm" -> ConfirmSheet appears asking for confirmation. Confirming calls `PATCH /api/bookings/:id/status` with `CONFIRMED`.
   - Test inline rejection: click "Reject" -> ConfirmSheet prompts for an optional rejection reason. Submitting updates status to `REJECTED`.
   - On mobile/touch devices: swipe left on the card using `SwipeRow` to reveal the red "Reject" action with haptic feedback.

---

## 4. Booking Detail & Financial Breakdown (`/owner/bookings/:id`)

### Step 4.1: Reservation Details
1. Click "Details" or open `/owner/bookings/:id`.
2. Inspect the sections:
   - **Header**: Booking reference ID, space title, property address, and color-coded status badge.
   - **Guest Information**: Name, phone with click-to-call `tel:` link, guest count.
   - **Reservation Schedule**: Check-in and check-out dates and times formatted in `Asia/Kolkata` time zone.
   - **Financial Overview**:
     - Rupee-formatted Total Customer Charge (including taxes)
     - Space Subtotal
     - Platform Service Fee (10% deduction)
     - Net Owner Payout (`ownerAmount`)
     - Customer Paid balance and remaining balance
   - **Payments Recorded**: List of payment receipts with transaction IDs, method, status, and timestamps.
   - **Reservation Timeline**: Chronological log of status transitions with notes and author.

### Step 4.2: State Machine Actions
1. Look at the "Allowed Actions" bar at the top of the booking detail page.
2. Confirm that only actions returned in `allowedNextActions` by the backend are rendered:
   - `confirm`: Shows "Confirm Booking" button.
   - `reject`: Shows "Reject Request" button (prompts for reason).
   - `cancel`: Shows "Cancel Booking" button (with clear refund notification).
   - `complete`: Shows "Mark as Completed" button (enabled after scheduled end time).
3. Attempting an invalid action surfaces a clear inline message (e.g. `SLOT_UNAVAILABLE`, `INVALID_TRANSITION`, or `BOOKING_NOT_ENDED`).

---

## 5. Security & Access Verification

1. Log out or switch to an account with the `CUSTOMER` role.
2. Attempt to browse to `/owner/properties` or `/owner/bookings`.
3. Verify that the `RoleRoute` guard blocks access and redirects to `/bookings`.
