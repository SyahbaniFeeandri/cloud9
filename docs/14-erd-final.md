# ERD Final FinCloud

**PIC:** Feeandri & Agustina  
**Minggu:** 2  
**Status:** Final

## 1. Entity Relationship Diagram

ERD Final FinCloud terdiri dari 6 entitas utama:

- `roles`
- `users`
- `categories`
- `transactions`
- `receipts`
- `audit_logs`

### 1.1 ERD

```mermaid
erDiagram
    ROLES ||--o{ USERS : "memiliki"
    USERS ||--o{ TRANSACTIONS : "mencatat"
    CATEGORIES ||--o{ TRANSACTIONS : "memiliki"
    TRANSACTIONS ||--o{ RECEIPTS : "memiliki"
    USERS ||--o{ AUDIT_LOGS : "menghasilkan"

    ROLES {
        SERIAL id PK
        VARCHAR name UK
        TEXT description
    }

    USERS {
        SERIAL id PK
        INTEGER role_id FK
        VARCHAR name
        VARCHAR email UK
        VARCHAR password_hash
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CATEGORIES {
        SERIAL id PK
        VARCHAR type
        VARCHAR name
        VARCHAR icon
    }

    TRANSACTIONS {
        SERIAL id PK
        INTEGER user_id FK
        INTEGER category_id FK
        VARCHAR transaction_type
        DECIMAL amount
        TEXT description
        DATE transaction_date
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    RECEIPTS {
        SERIAL id PK
        INTEGER transaction_id FK
        VARCHAR object_url
        VARCHAR object_key
        VARCHAR filename
        VARCHAR file_type
        TIMESTAMP uploaded_at
    }

    AUDIT_LOGS {
        SERIAL id PK
        INTEGER user_id FK
        VARCHAR action
        VARCHAR entity
        INTEGER entity_id
        VARCHAR ip_address
        TIMESTAMP created_at
    }
