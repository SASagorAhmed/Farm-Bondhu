# FarmBondhu Database ER Documentation

This document summarizes the FarmBondhu PostgreSQL database structure from `backend/src/db/ensureSchema.js`.

FarmBondhu uses one database for a multi-service SaaS ecosystem:

- Identity and access
- Farm management
- Cow weight and AI feedback
- GreenBondhu Marketplace
- Marketplace chat and moderation
- Community
- VetBondhu veterinary consultation
- MediBondhu human healthcare
- Admin, support, notifications, and operational audit

---

## How To Read This Document

- `PK` means primary key.
- `FK` means a declared PostgreSQL foreign key using `REFERENCES`.
- `Logical FK` means the column stores another table's ID and is used by the app as a relationship, but the schema does not always declare a PostgreSQL FK constraint.
- `profiles.id` is the central user identity used by most modules.
- Some domain tables use `user_id`, `buyer_id`, `seller_id`, `patient_user_id`, `doctor_user_id`, or `vet_user_id`; these are all user identity references to `profiles.id` unless noted otherwise.

---

## 1. Identity And Access

```mermaid
erDiagram
  PROFILES {
    uuid id PK
    text email
    text name
    text primary_role
    text status
  }

  AUTH_CREDENTIALS {
    uuid user_id PK_FK
    text password_hash
  }

  USER_ROLES {
    uuid user_id Logical_FK
    text role
  }

  ROLE_PERMISSIONS {
    text role PK
    text permission_code PK
  }

  USER_CAPABILITIES {
    uuid user_id PK_Logical_FK
    text capability_code PK
    boolean is_enabled
    uuid granted_by Logical_FK
  }

  APPROVAL_REQUESTS {
    uuid id PK
    uuid user_id Logical_FK
    text request_type
    text status
  }

  USER_ADDRESSES {
    uuid id PK
    uuid user_id FK
    text full_name
    text phone
    text division
    text district
    text upazila
  }

  PROFILES ||--|| AUTH_CREDENTIALS : auth_credentials
  PROFILES ||--o{ USER_ROLES : roles
  USER_ROLES }o--o{ ROLE_PERMISSIONS : permissions
  PROFILES ||--o{ USER_CAPABILITIES : capabilities
  PROFILES ||--o{ USER_CAPABILITIES : granted_by
  PROFILES ||--o{ APPROVAL_REQUESTS : requests
  PROFILES ||--o{ USER_ADDRESSES : addresses
```

### Identity and access table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `profiles` | `id` | Root user table | Central identity profile |
| `auth_credentials` | `user_id` | Declared FK to `profiles.id` | Password hash for app auth |
| `user_roles` | unique `user_id, role` | Logical FK to `profiles.id` | User role assignment |
| `role_permissions` | `role, permission_code` | Role lookup | Permission seed map |
| `user_capabilities` | `user_id, capability_code` | Logical FK to `profiles.id`; `granted_by` logical FK | Fine-grained access |
| `approval_requests` | `id` | Logical FK `user_id` | Access and role request workflow |
| `user_addresses` | `id` | Declared FK to `profiles.id` | Delivery/contact addresses |

---

## 2. Farm Management And Cow AI

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  FARMS {
    uuid id PK
    uuid user_id Logical_FK
    text name
    text location
    text type
  }

  ANIMALS {
    uuid id PK
    uuid user_id Logical_FK
    uuid farm_id Logical_FK
    text type
    text tracking_mode
    text breed
    text health_status
  }

  SHEDS {
    uuid id PK
    uuid user_id Logical_FK
    uuid farm_id Logical_FK
    text name
    integer capacity
    text status
  }

  FEED_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    uuid farm_id Logical_FK
    uuid animal_id Logical_FK
    date date
    text feed_type
  }

  FEED_INVENTORY {
    uuid id PK
    uuid user_id Logical_FK
    text name
    numeric stock
  }

  HEALTH_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    uuid animal_id Logical_FK
    date date
    text type
  }

  PRODUCTION_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    date date
    integer eggs
    numeric milk
  }

  FINANCIAL_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    date date
    text type
    numeric amount
  }

  MORTALITY_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    uuid farm_id Logical_FK
    date date
    integer count
  }

  SALE_RECORDS {
    uuid id PK
    uuid user_id Logical_FK
    date date
    text product
    numeric total
  }

  COW_WEIGHT_ESTIMATIONS {
    uuid id PK
    uuid user_id Logical_FK
    uuid farm_id Logical_FK
    uuid animal_id Logical_FK
    numeric estimated_live_weight_kg
  }

  COW_DETECTION_FEEDBACK {
    uuid id PK
    uuid user_id Logical_FK
    uuid estimation_id Logical_FK
  }

  PROFILES ||--o{ FARMS : owns
  PROFILES ||--o{ ANIMALS : owns
  FARMS ||--o{ ANIMALS : contains
  FARMS ||--o{ SHEDS : has
  PROFILES ||--o{ FEED_RECORDS : logs
  FARMS ||--o{ FEED_RECORDS : feed_records
  ANIMALS ||--o{ FEED_RECORDS : feed_records
  PROFILES ||--o{ FEED_INVENTORY : owns
  PROFILES ||--o{ HEALTH_RECORDS : logs
  ANIMALS ||--o{ HEALTH_RECORDS : health_records
  PROFILES ||--o{ PRODUCTION_RECORDS : logs
  PROFILES ||--o{ FINANCIAL_RECORDS : logs
  PROFILES ||--o{ MORTALITY_RECORDS : logs
  FARMS ||--o{ MORTALITY_RECORDS : mortality
  PROFILES ||--o{ SALE_RECORDS : logs
  PROFILES ||--o{ COW_WEIGHT_ESTIMATIONS : creates
  FARMS ||--o{ COW_WEIGHT_ESTIMATIONS : estimates
  ANIMALS ||--o{ COW_WEIGHT_ESTIMATIONS : estimates
  COW_WEIGHT_ESTIMATIONS ||--o{ COW_DETECTION_FEEDBACK : feedback
```

### Farm and AI table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `farms` | `id` | Logical FK `user_id` | Farm/workspace records |
| `animals` | `id` | Logical FK `user_id`, `farm_id` | Individual or batch animal records |
| `sheds` | `id` | Logical FK `user_id`, `farm_id` | Housing/capacity records |
| `feed_records` | `id` | Logical FK `user_id`, `farm_id`, `animal_id` | Feed logs |
| `feed_inventory` | `id` | Logical FK `user_id` | Feed stock tracking |
| `health_records` | `id` | Logical FK `user_id`, `animal_id` | Health/treatment logs |
| `production_records` | `id` | Logical FK `user_id` | Milk/egg/output records |
| `financial_records` | `id` | Logical FK `user_id` | Income/expense records |
| `mortality_records` | `id` | Logical FK `user_id`, `farm_id` | Animal loss records |
| `sale_records` | `id` | Logical FK `user_id` | Farm sales records |
| `cow_weight_estimations` | `id` | Logical FK `user_id`, `farm_id`, `animal_id` | AI/manual cow weight estimates |
| `cow_detection_feedback` | `id` | Logical FK `user_id`, `estimation_id` | Cow detection feedback/training data |

---

## 3. GreenBondhu Marketplace And Chat

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  SHOPS {
    uuid user_id PK_Logical_FK
    text shop_name
  }

  PRODUCTS {
    uuid id PK
    uuid seller_id Logical_FK
    text name
    numeric price
    integer stock
    text listing_status
  }

  ORDERS {
    uuid id PK
    uuid buyer_id Logical_FK
    uuid seller_id Logical_FK
    jsonb items
    numeric total
    text status
  }

  CONVERSATIONS {
    uuid id PK
    uuid buyer_id Logical_FK
    uuid seller_id Logical_FK
    uuid product_id Logical_FK
  }

  CHAT_MESSAGES {
    uuid id PK
    uuid conversation_id Logical_FK
    uuid sender_id Logical_FK
    uuid shared_product_id Logical_FK
  }

  CHAT_MESSAGE_TRANSLATIONS {
    uuid message_id PK_FK
    text target_lang PK
    text translated_text
  }

  CHAT_CONTACT_VIOLATIONS {
    uuid id PK
    uuid user_id Logical_FK
    uuid conversation_id Logical_FK
  }

  MARKETPLACE_CONVERSATION_REPORTS {
    uuid id PK
    uuid conversation_id Logical_FK
    uuid reported_by Logical_FK
    text status
  }

  MARKETPLACE_PRODUCT_REVIEWS {
    uuid id PK
    uuid order_id Logical_FK
    uuid product_id Logical_FK
    uuid buyer_id Logical_FK
    uuid seller_id Logical_FK
  }

  MARKETPLACE_PRODUCT_COMMENTS {
    uuid id PK
    uuid product_id Logical_FK
    uuid user_id Logical_FK
  }

  SELLER_LANE_GRANTS {
    uuid user_id PK_Logical_FK
    text lane PK
    text status
  }

  SELLER_WITHDRAWALS {
    uuid id PK
    uuid seller_user_id Logical_FK
    numeric request_amount
    text status
  }

  MARKETPLACE_BANNERS {
    uuid id PK
    text image_url
    boolean is_active
  }

  MARKETING_DESIGN_DRAFTS {
    uuid id PK
    uuid user_id Logical_FK
    text title
    jsonb canvas_json
  }

  PROFILES ||--|| SHOPS : shop
  PROFILES ||--o{ PRODUCTS : sells
  PROFILES ||--o{ ORDERS : buys
  PROFILES ||--o{ ORDERS : sells
  PROFILES ||--o{ CONVERSATIONS : buyer
  PROFILES ||--o{ CONVERSATIONS : seller
  PRODUCTS ||--o{ CONVERSATIONS : discussed
  CONVERSATIONS ||--o{ CHAT_MESSAGES : messages
  PROFILES ||--o{ CHAT_MESSAGES : sends
  PRODUCTS ||--o{ CHAT_MESSAGES : shared
  CHAT_MESSAGES ||--o{ CHAT_MESSAGE_TRANSLATIONS : translations
  CONVERSATIONS ||--o{ CHAT_CONTACT_VIOLATIONS : violations
  PROFILES ||--o{ CHAT_CONTACT_VIOLATIONS : creates
  CONVERSATIONS ||--o{ MARKETPLACE_CONVERSATION_REPORTS : reports
  PROFILES ||--o{ MARKETPLACE_CONVERSATION_REPORTS : reports
  ORDERS ||--o{ MARKETPLACE_PRODUCT_REVIEWS : reviews
  PRODUCTS ||--o{ MARKETPLACE_PRODUCT_REVIEWS : reviews
  PRODUCTS ||--o{ MARKETPLACE_PRODUCT_COMMENTS : comments
  PROFILES ||--o{ MARKETPLACE_PRODUCT_COMMENTS : writes
  PROFILES ||--o{ SELLER_LANE_GRANTS : lane_grants
  PROFILES ||--o{ SELLER_WITHDRAWALS : withdrawals
  PROFILES ||--o{ MARKETING_DESIGN_DRAFTS : drafts
```

### Marketplace table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `shops` | `user_id` | Logical FK to `profiles.id` | Seller shop profile |
| `products` | `id` | Logical FK `seller_id` | Product listings |
| `orders` | `id` | Logical FK `buyer_id`, `seller_id` | Buyer/seller orders |
| `conversations` | `id` | Logical FK `buyer_id`, `seller_id`, `product_id` | Buyer-seller chat threads |
| `chat_messages` | `id` | Logical FK `conversation_id`, `sender_id`, `shared_product_id` | Marketplace chat messages |
| `chat_message_translations` | `message_id, target_lang` | Declared FK to `chat_messages.id` | Per-message translation cache |
| `chat_contact_violations` | `id` | Logical FK `user_id`, `conversation_id` | Contact-guard violations |
| `marketplace_conversation_reports` | `id` | Logical FK `conversation_id`, `reported_by` | Chat report workflow |
| `marketplace_product_reviews` | `id` | Logical FK `order_id`, `product_id`, `buyer_id`, `seller_id` | Product reviews |
| `marketplace_product_comments` | `id` | Logical FK `product_id`, `user_id` | Product comments |
| `seller_lane_grants` | `user_id, lane` | Logical FK `user_id`, `reviewed_by` | Seller lane approval |
| `seller_withdrawals` | `id` | Logical FK `seller_user_id`, `reviewed_by` | Seller payout request |
| `marketplace_banners` | `id` | Standalone | Browse/banner carousel configuration |
| `marketing_design_drafts` | `id` | Logical FK `user_id` | Seller photo-editor drafts |

---

## 4. Community And Learning

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  COMMUNITY_POSTS {
    uuid id PK
    uuid user_id Logical_FK
    text post_type
    text title
    text category
    text status
  }

  COMMUNITY_COMMENTS {
    uuid id PK
    uuid post_id Logical_FK
    uuid user_id Logical_FK
  }

  COMMUNITY_ANSWERS {
    uuid id PK
    uuid post_id Logical_FK
    uuid user_id Logical_FK
    boolean is_best_answer
  }

  COMMUNITY_REACTIONS {
    uuid id PK
    uuid post_id Logical_FK
    uuid user_id Logical_FK
  }

  COMMUNITY_SAVES {
    uuid id PK
    uuid post_id Logical_FK
    uuid user_id Logical_FK
  }

  COMMUNITY_REPORTS {
    uuid id PK
    uuid post_id Logical_FK
    uuid reported_by Logical_FK
    text status
  }

  LEARNING_GUIDES {
    uuid id PK
    text title
    text category
    boolean is_published
  }

  PROFILES ||--o{ COMMUNITY_POSTS : writes
  COMMUNITY_POSTS ||--o{ COMMUNITY_COMMENTS : comments
  COMMUNITY_POSTS ||--o{ COMMUNITY_ANSWERS : answers
  COMMUNITY_POSTS ||--o{ COMMUNITY_REACTIONS : reactions
  COMMUNITY_POSTS ||--o{ COMMUNITY_SAVES : saves
  COMMUNITY_POSTS ||--o{ COMMUNITY_REPORTS : reports
  PROFILES ||--o{ COMMUNITY_COMMENTS : writes
  PROFILES ||--o{ COMMUNITY_ANSWERS : writes
  PROFILES ||--o{ COMMUNITY_REACTIONS : reacts
  PROFILES ||--o{ COMMUNITY_SAVES : saves
  PROFILES ||--o{ COMMUNITY_REPORTS : reports
```

### Community and learning table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `community_posts` | `id` | Logical FK `user_id` | Community posts/questions |
| `community_comments` | `id` | Logical FK `post_id`, `user_id` | Post comments |
| `community_answers` | `id` | Logical FK `post_id`, `user_id` | Q&A answers |
| `community_reactions` | `id`; unique `post_id, user_id` | Logical FK `post_id`, `user_id` | Reactions |
| `community_saves` | `id`; unique `post_id, user_id` | Logical FK `post_id`, `user_id` | Saved posts |
| `community_reports` | `id` | Logical FK `post_id`, `reported_by` | Moderation reports |
| `learning_guides` | `id` | Standalone | Published learning content |

---

## 5. VetBondhu

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  VETS {
    uuid id PK
    uuid user_id Logical_FK
    text name
    boolean verified
  }

  VET_PROFILES {
    uuid id PK
    uuid user_id Logical_FK
    text full_name
    text verification_status
  }

  VET_AVAILABILITY {
    uuid id PK
    uuid user_id Logical_FK
    text day
    text start_time
    text end_time
  }

  CONSULTATION_BOOKINGS {
    uuid id PK
    uuid patient_mock_id Logical_FK
    uuid vet_id Logical_FK
    uuid vet_user_id Logical_FK
    text status
  }

  CONSULTATION_MESSAGES {
    uuid id PK
    uuid booking_id Logical_FK
    uuid sender_id Logical_FK
  }

  PRESCRIPTIONS {
    uuid id PK
    uuid vet_id Logical_FK
    uuid patient_id Logical_FK
    text status
  }

  PRESCRIPTION_ITEMS {
    uuid id PK
    uuid prescription_id Logical_FK
  }

  E_PRESCRIPTIONS {
    uuid id PK
    uuid patient_mock_id Logical_FK
    uuid vet_id Logical_FK
    text status
  }

  VET_WITHDRAWALS {
    uuid id PK
    uuid vet_user_id Logical_FK
    numeric request_amount
    text status
  }

  PROFILES ||--o{ VETS : vet_account
  PROFILES ||--o{ VET_PROFILES : vet_profile
  PROFILES ||--o{ VET_AVAILABILITY : availability
  PROFILES ||--o{ CONSULTATION_BOOKINGS : patient
  VETS ||--o{ CONSULTATION_BOOKINGS : assigned
  CONSULTATION_BOOKINGS ||--o{ CONSULTATION_MESSAGES : messages
  PROFILES ||--o{ CONSULTATION_MESSAGES : sends
  VETS ||--o{ PRESCRIPTIONS : issues
  PROFILES ||--o{ PRESCRIPTIONS : patient
  PRESCRIPTIONS ||--o{ PRESCRIPTION_ITEMS : items
  VETS ||--o{ E_PRESCRIPTIONS : issues
  PROFILES ||--o{ E_PRESCRIPTIONS : patient
  PROFILES ||--o{ VET_WITHDRAWALS : withdrawals
```

### VetBondhu table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `vets` | `id` | Logical FK `user_id` | Vet listing/identity |
| `vet_profiles` | `id` | Logical FK `user_id`; unique user | Vet verification profile |
| `vet_availability` | `id` | Logical FK `user_id` | Vet schedule windows |
| `consultation_bookings` | `id` | Logical FK `patient_mock_id`, `vet_id`, `vet_user_id` | VetBondhu consultation booking |
| `consultation_messages` | `id` | Logical FK `booking_id`, `sender_id` | VetBondhu room/chat messages |
| `prescriptions` | `id` | Logical FK `vet_id`, `patient_id` | Vet prescription header |
| `prescription_items` | `id` | Logical FK `prescription_id` | Vet prescription medicines/items |
| `e_prescriptions` | `id` | Logical FK `patient_mock_id`, `vet_id` | Active e-prescription records |
| `vet_withdrawals` | `id` | Logical FK `vet_user_id`, `reviewed_by` | Vet payout withdrawal |

---

## 6. MediBondhu

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  MEDIBONDHU_SPECIALTIES {
    uuid id PK
    text name
    text slug
  }

  MEDIBONDHU_HOSPITALS {
    uuid id PK
    text name
    text address
  }

  MEDIBONDHU_DOCTORS {
    uuid id PK
    uuid user_id Logical_FK
    uuid specialty_id FK
    uuid hospital_id FK
    text full_name
    text approval_status
  }

  MEDIBONDHU_DOCTOR_TIME_SLOTS {
    uuid id PK
    uuid doctor_id FK
    date slot_date
    timestamptz slot_start
    timestamptz slot_end
  }

  MEDIBONDHU_APPOINTMENTS {
    uuid id PK
    uuid patient_user_id Logical_FK
    uuid doctor_id FK
    uuid slot_id FK
    uuid specialty_id FK
    text consultation_type
    text status
  }

  MEDIBONDHU_APPOINTMENT_MESSAGES {
    uuid id PK
    uuid appointment_id FK
    uuid sender_id Logical_FK
  }

  MEDIBONDHU_PRESCRIPTIONS {
    uuid id PK
    uuid appointment_id FK
    uuid doctor_id FK
    uuid patient_user_id Logical_FK
  }

  MEDIBONDHU_PRESCRIPTION_ITEMS {
    uuid id PK
    uuid prescription_id FK
    text medication_name
  }

  MEDIBONDHU_DOCTOR_WITHDRAWALS {
    uuid id PK
    uuid doctor_user_id Logical_FK
    numeric request_amount
    text status
  }

  MEDIBONDHU_SPECIALTIES ||--o{ MEDIBONDHU_DOCTORS : specialty
  MEDIBONDHU_HOSPITALS ||--o{ MEDIBONDHU_DOCTORS : hospital
  PROFILES ||--o{ MEDIBONDHU_DOCTORS : doctor_user
  MEDIBONDHU_DOCTORS ||--o{ MEDIBONDHU_DOCTOR_TIME_SLOTS : slots
  PROFILES ||--o{ MEDIBONDHU_APPOINTMENTS : patient
  MEDIBONDHU_DOCTORS ||--o{ MEDIBONDHU_APPOINTMENTS : doctor
  MEDIBONDHU_DOCTOR_TIME_SLOTS ||--o{ MEDIBONDHU_APPOINTMENTS : slot
  MEDIBONDHU_SPECIALTIES ||--o{ MEDIBONDHU_APPOINTMENTS : specialty
  MEDIBONDHU_APPOINTMENTS ||--o{ MEDIBONDHU_APPOINTMENT_MESSAGES : messages
  PROFILES ||--o{ MEDIBONDHU_APPOINTMENT_MESSAGES : sends
  MEDIBONDHU_APPOINTMENTS ||--o{ MEDIBONDHU_PRESCRIPTIONS : prescription
  MEDIBONDHU_DOCTORS ||--o{ MEDIBONDHU_PRESCRIPTIONS : issues
  PROFILES ||--o{ MEDIBONDHU_PRESCRIPTIONS : patient
  MEDIBONDHU_PRESCRIPTIONS ||--o{ MEDIBONDHU_PRESCRIPTION_ITEMS : items
  PROFILES ||--o{ MEDIBONDHU_DOCTOR_WITHDRAWALS : withdrawals
```

### MediBondhu table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `medibondhu_specialties` | `id` | Standalone | Human doctor specialties |
| `medibondhu_hospitals` | `id` | Standalone | Hospital/chamber records |
| `medibondhu_doctors` | `id` | Declared FK `specialty_id`, `hospital_id`; logical FK `user_id` | Human doctor profile |
| `medibondhu_doctor_time_slots` | `id` | Declared FK `doctor_id` | Doctor availability slots |
| `medibondhu_appointments` | `id` | Declared FK `doctor_id`, `slot_id`, `specialty_id`; logical FK `patient_user_id` | Patient appointment |
| `medibondhu_appointment_messages` | `id` | Declared FK `appointment_id`; logical FK `sender_id` | Appointment chat |
| `medibondhu_prescriptions` | `id` | Declared FK `appointment_id`, `doctor_id`; logical FK `patient_user_id` | Human prescription header |
| `medibondhu_prescription_items` | `id` | Declared FK `prescription_id` | Prescription items |
| `medibondhu_doctor_withdrawals` | `id` | Logical FK `doctor_user_id`, `reviewed_by` | Doctor payout withdrawal |

---

## 7. Admin, Support, Notifications, And Audit

```mermaid
erDiagram
  PROFILES {
    uuid id PK
  }

  NOTIFICATIONS {
    uuid id PK
    uuid user_id Logical_FK
    text title
    text type
    boolean read
  }

  ADMIN_TEAM {
    uuid id PK
    uuid user_id Logical_FK
    text email
    text admin_role
  }

  EMAIL_AUDIT_LOG {
    uuid id PK
    text email_type
    text recipient_email
    text status
  }

  REGISTRATION_PENDING {
    text email PK
    jsonb profile_data
    timestamptz expires_at
  }

  PASSWORD_RESET_PENDING {
    text email PK
    uuid user_id Logical_FK
    timestamptz expires_at
  }

  PROFILES ||--o{ NOTIFICATIONS : receives
  PROFILES ||--o{ ADMIN_TEAM : admin_profile
  PROFILES ||--o{ PASSWORD_RESET_PENDING : resets
```

### Admin/support table summary

| Table | Primary key | FK / logical FK | Purpose |
| --- | --- | --- | --- |
| `notifications` | `id` | Logical FK `user_id` | Account-scoped notifications |
| `admin_team` | `id` | Logical FK `user_id` | Admin team profiles/permissions |
| `email_audit_log` | `id` | Standalone | Email delivery/audit records |
| `registration_pending` | `email` | Standalone | OTP registration staging |
| `password_reset_pending` | `email` | Logical FK `user_id` | Password reset OTP staging |

---

## Notes About Declared Vs Logical Foreign Keys

The schema declares some FK constraints directly, especially in:

- `auth_credentials.user_id -> profiles.id`
- `user_addresses.user_id -> profiles.id`
- `chat_message_translations.message_id -> chat_messages.id`
- MediBondhu doctor, slot, appointment, message, and prescription tables

Many other relationships are enforced by application logic and ownership checks rather than database-level constraints. This is why the diagrams label them as `Logical_FK`.

For example:

- `farms.user_id` logically points to `profiles.id`
- `animals.farm_id` logically points to `farms.id`
- `orders.buyer_id` and `orders.seller_id` logically point to `profiles.id`
- `community_comments.post_id` logically points to `community_posts.id`
- `consultation_messages.booking_id` logically points to `consultation_bookings.id`

---

## Recommended Future Schema Hardening

If the project moves toward stricter database integrity, consider adding declared FK constraints for high-value relationships:

- Farm records to `profiles`, `farms`, and `animals`
- Marketplace orders/products/chats to users and products
- Community comments/answers/reactions/saves to posts and users
- VetBondhu bookings/messages/prescriptions to users and vets
- Notification ownership to `profiles`

Before adding strict constraints, clean or backfill existing data so older rows do not violate the new rules.
