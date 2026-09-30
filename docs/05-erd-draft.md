# ERD Draft FinCloud

## Diagram Relasi
roles (1) ──── (N) users
users (1) ──── (N) transactions
users (1) ──── (N) audit_logs
categories (1) ──── (N) transactions
transactions (1) ──── (N) receipts

text

## Detail Tabel

### users
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| role_id | INT FK → roles.id | |
| name | VARCHAR(100) | |
| email | VARCHAR(150) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### roles
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(20) | USER / ADMIN |
| description | TEXT | |

### categories
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| type | VARCHAR(10) | income / expense |
| name | VARCHAR(50) | |
| icon | VARCHAR(50) | opsional |

### transactions
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| user_id | INT FK → users.id | |
| category_id | INT FK → categories.id | |
| transaction_type | VARCHAR(10) | income / expense |
| amount | DECIMAL(15,2) | |
| description | TEXT | |
| transaction_date | DATE | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Index:** `idx_transactions_user_date (user_id, transaction_date)`

### receipts
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| transaction_id | INT FK → transactions.id | |
| object_url | VARCHAR(255) | |
| object_key | VARCHAR(255) | |
| filename | VARCHAR(150) | |
| file_type | VARCHAR(50) | JPG/PNG/PDF |
| uploaded_at | TIMESTAMP | |

### audit_logs
| Field | Tipe | Keterangan |
|---|---|---|
| id | SERIAL PK | |
| user_id | INT FK → users.id | nullable |
| action | VARCHAR(50) | USER_LOGIN, TRANSACTION_CREATE, dll |
| entity | VARCHAR(50) | |
| entity_id | INT | |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMP | |

## Kategori Seed Data
### Income
Salary, Business, Investment, Bonus, Other

### Expense
Food, Transportation, Housing, Education, Healthcare,
Entertainment, Shopping, Utilities, Other
