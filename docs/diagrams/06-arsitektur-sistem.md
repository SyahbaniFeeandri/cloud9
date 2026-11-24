# Diagram & Spesifikasi Arsitektur Sistem FinCloud

Dokumen ini menjelaskan arsitektur sistem **FinCloud (Cloud-Based Financial Management & Monitoring Platform)** yang dikembangkan oleh tim **Cloud9**. Arsitektur ini mengadopsi pola *layered cloud-native architecture* yang memisahkan antarmuka pengguna, reverse proxy, layanan backend, persistensi data relasional, penyimpanan berkas objek, dan sistem observabilitas.

---

## 1. Diagram Arsitektur (Mermaid)

```mermaid
flowchart TB
    %% =========================================================================
    %% FINCLOUD SYSTEM ARCHITECTURE DIAGRAM
    %% Components: Frontend, Nginx, Backend, MariaDB, MinIO,
    %%             Prometheus, Node Exporter, cAdvisor, Loki, Promtail, Grafana
    %% =========================================================================

    subgraph CLIENT_TIER [" 🌐 CLIENT / PRESENTATION TIER "]
        direction TB
        User["👤 End User (Client Browser)<br/>Dashboard, Transaksi & Upload Struk"]
        Admin["👨‍💻 System Admin / DevOps<br/>Monitoring & Sistem Manajemen"]
    end

    subgraph INGRESS_TIER [" 🛡️ EDGE & REVERSE PROXY TIER "]
        direction TB
        Nginx["🌐 Nginx Central Reverse Proxy<br/>Public Port: 8080 (HTTP) / 8443 (HTTPS)<br/>• Serves SPA via frontend:80<br/>• Proxy /api/ → backend:5000<br/>• Proxy /storage/ → minio:9000<br/>• TLS, Security Headers & Request Limits"]
    end

    subgraph APP_TIER [" ⚙️ APPLICATION & LOGIC TIER "]
        direction TB
        FrontendSPA["💻 FinCloud Frontend SPA<br/>HTML5, Vanilla CSS, JS ES6<br/>Internal Port: 80 (static)"]
        BackendAPI["⚡ FinCloud Backend API<br/>RESTful Service & Business Logic<br/>Internal Port: 5000<br/>• JWT Authentication & RBAC<br/>• Transaction CRUD & Report Analytics<br/>• S3 Client SDK (Upload Manager)<br/>• Metrics Exporter (/metrics)"]
    end

    subgraph STORAGE_TIER [" 💾 PERSISTENCE & STORAGE TIER "]
        direction TB
        MariaDB[("🗄️ MariaDB Database<br/>Internal Port: 3306<br/>• Users & Roles<br/>• Transactions & Categories<br/>• Receipts Metadata & Audit Logs")]
        MinIO[("🪣 MinIO Object Storage (S3-Compatible)<br/>Internal API: 9000 | Console: 9001<br/>• Bucket: fincloud-receipts<br/>• Struk Pembayaran & File Invoice")]
    end

    subgraph MONITORING_TIER [" 📊 MONITORING & OBSERVABILITY TIER "]
        direction TB
        Prometheus["🔥 Prometheus Time-Series Server<br/>Loopback Port: 9090<br/>• Scrapes 4 Job (Backend, Self, Host, Container)<br/>• Storage TSDB 15 Hari & 10 Alert Rules"]
        NodeExporter["🖥️ Node Exporter<br/>Loopback Port: 9100<br/>• CPU, Memory, Disk & Network Host"]
        Cadvisor["📦 cAdvisor<br/>Loopback Port: 8081<br/>• CPU, Memory & Status per Container"]
        Loki["🗃️ Loki Log Aggregation<br/>Loopback Port: 3100<br/>• Log Terpusat, Retensi 7 Hari"]
        Promtail["🚚 Promtail Log Shipper<br/>Internal Only<br/>• Docker Socket → Loki"]
        Grafana["📈 Grafana Visualization Platform<br/>Loopback Port: 3001<br/>• Overview (RED), Infrastructure & Logs<br/>• Audit Trail via Loki"]
    end

    %% Client Interactions
    User -->|"HTTP / HTTPS Requests (Port 8080/8443)"| Nginx
    Admin -->|"Akses Web Admin & Monitoring"| Nginx
    Admin -.->|"Loopback Dashboard (Port 3001)"| Grafana

    %% Nginx Routing
    Nginx -->|"Proxy Path: / (Static SPA Assets)"| FrontendSPA
    Nginx -->|"Proxy Path: /api/* (REST API Calls)"| BackendAPI
    Nginx -->|"Proxy Path: /storage/* (Presigned Receipts)"| MinIO

    %% Frontend to Backend Interaction
    FrontendSPA -->|"REST API (JSON Data & JWT Token)"| BackendAPI

    %% Backend to Database & Storage
    BackendAPI -->|"SQL Queries (TCP Port 3306)<br/>Data Relasional & Audit Log"| MariaDB
    BackendAPI -->|"S3 API Protocol (HTTP Port 9000)<br/>PutObject / GetObject Bukti Struk"| MinIO

    %% Observability Scraping (Prometheus Pull Model)
    Prometheus -.->|"Scrape /metrics (Port 5000)"| BackendAPI
    Prometheus -.->|"Self-scrape (Port 9090)"| Prometheus
    Prometheus -.->|"Scrape (Port 9100)"| NodeExporter
    Prometheus -.->|"Scrape (Port 8080)"| Cadvisor

    %% Log Shipping (Push Model)
    Promtail -->|"Push Log API (Port 3100)"| Loki
    Promtail -.->|"Baca Log Container (Docker Socket)"| BackendAPI
    Promtail -.->|"Baca Log Container (Docker Socket)"| Nginx

    %% Grafana Data Sources
    Grafana -->|"PromQL Queries (Port 9090)"| Prometheus
    Grafana -->|"LogQL Queries (Port 3100)"| Loki

    %% Styling & Classes
    classDef clientClass fill:#2B6CB0,stroke:#1A365D,stroke-width:2px,color:#FFFFFF;
    classDef proxyClass fill:#2F855A,stroke:#1C4532,stroke-width:2px,color:#FFFFFF;
    classDef appClass fill:#3182CE,stroke:#2B6CB0,stroke-width:2px,color:#FFFFFF;
    classDef dbClass fill:#DD6B20,stroke:#7B341E,stroke-width:2px,color:#FFFFFF;
    classDef s3Class fill:#C53030,stroke:#742A2A,stroke-width:2px,color:#FFFFFF;
    classDef monitorClass fill:#6B46C1,stroke:#44337A,stroke-width:2px,color:#FFFFFF;
    classDef vizClass fill:#D69E2E,stroke:#744210,stroke-width:2px,color:#FFFFFF;

    class User,Admin clientClass;
    class Nginx proxyClass;
    class FrontendSPA,BackendAPI appClass;
    class MariaDB dbClass;
    class MinIO s3Class;
    class Prometheus,NodeExporter,Cadvisor,Loki,Promtail monitorClass;
    class Grafana vizClass;
```

---

## 2. Rincian Komponen Arsitektur

| Komponen | Layer / Tier | Port Standar | Peran & Tanggung Jawab Utama |
|---|---|---|---|
| **Frontend (SPA)** | Client / Web App | `3000` | Antarmuka pengguna berbasis Single Page Application (HTML5, Vanilla CSS, JS ES6). Mengelola routing sisi klien (`#/dashboard`, `#/transactions`, `#/reports`), state management, visualisasi grafik canvas, dan interaksi formulir. |
| **Nginx** | Edge / Ingress Reverse Proxy | **`8080`** (HTTP) / **`8443`** (HTTPS, public) | Pintu gerbang tunggal (*single point of entry*): menyajikan SPA melalui `frontend:80`, reverse proxy ke API (`/api/`), reverse proxy objek struk (`/storage/`), terminasi SSL/TLS, serta *security headers* dan batas ukuran request. Service lain hanya loopback/internal. |
| **Backend API** | Application Logic | `8000` | Core service RESTful API. Memproses autentikasi JWT & Role-Based Access Control (RBAC), kalkulasi agregasi finansial, validasi input, transaksi basis data, komunikasi S3 SDK dengan MinIO, dan mengekspos endpoint metrik `/metrics`. |
| **MariaDB** | Relational Database | `3306` | Basis data relasional ACID untuk menyimpan entitas terstruktur: `roles`, `users`, `categories`, `transactions`, `receipts` (metadata berkas), dan `audit_logs`. |
| **MinIO** | Object Storage (S3-Compatible) | `9000` (API)<br/>`9001` (Console) | Penyimpanan objek terdistribusi berkinerja tinggi untuk berkas biner non-relasional, seperti gambar struk bukti pembayaran (*receipts*), faktur, atau dokumen PDF transaksi dalam bucket `fincloud-receipts`. |
| **Prometheus** | Monitoring & Alerting | `9090` | *Time-series metrics engine* yang melakukan *pull/scraping* 4 job (backend `/metrics`, self-scrape, Node Exporter, cAdvisor) setiap 15 detik. Menyediakan *PromQL engine*, penyimpanan TSDB 15 hari, serta evaluasi 10 *alerting rules* (`infra/prometheus/alert.rules.yml`). |
| **Node Exporter** | Host Metrics | `9100` | Mengekspos metrik tingkat host (CPU, memory, filesystem, network) dari `/proc` dan `/sys` Docker host untuk di-scrape Prometheus. |
| **cAdvisor** | Container Metrics | `8081` | Mengekspos metrik per container (CPU, memory working set, filesystem, status) sehingga konsumsi tiap service FinCloud dapat dipantau. |
| **Loki** | Log Aggregation | `3100` | Mengagregasi log seluruh container dengan penyimpanan filesystem dan retensi 7 hari. Menjadi datasource LogQL di Grafana. |
| **Promtail** | Log Shipper | internal | Menemukan container lewat Docker socket, memberi label `service`/`container`/`stream`, lalu mengirim log ke Loki. |
| **Grafana** | Visualisasi & Observabilitas | `3001` | Antarmuka visual analitik metrik dan log real-time. Tiga dashboard ter-provision otomatis: **FinCloud Overview** (*RED metrics*), **Infrastructure & Containers**, dan **Logs & Audit Trail** (Prometheus + Loki). |

---

## 3. Alur Komunikasi & Interaksi Sistem (Traffic Flow)

### A. Alur Transaksi & Upload Bukti Pembayaran (Write Path)
1. **Pengguna** membuka halaman Transaksi pada browser dan mengunggah struk bukti pembayaran.
2. Request `multipart/form-data` dikirim melalui **Nginx** via rute `/api/transactions`.
3. **Backend API** memverifikasi token JWT pengguna dan memproses payload.
4. Berkas gambar struk dikirim oleh backend ke **MinIO** menggunakan S3 API `PutObject` ke dalam bucket `fincloud-receipts`. MinIO mengembalikan *Object Key / URL*.
5. Metadata transaksi beserta *Object Key* struk disimpan ke dalam tabel `transactions` dan `receipts` pada **MariaDB**.
6. Response `201 Created` dikembalikan ke frontend dan antarmuka memperbarui daftar transaksi secara reaktif.

### B. Alur Pembacaan Laporan & Dashboard (Read Path)
1. Pengguna mengakses `#/dashboard` atau `#/reports`.
2. Frontend meminta agregasi data melalui endpoint `/api/reports/...`.
3. **Backend API** mengeksekusi kueri agregasi SQL (`SUM`, `COUNT`, `GROUP BY`) ke **MariaDB**.
4. Data JSON dikembalikan dan dirender oleh frontend ke dalam grafik Canvas (*Bar Chart* dan *Donut Chart*).

### C. Alur Monitoring & Observabilitas (Metrics & Logs Path)
1. Setiap interval (misalnya per 15 detik), **Prometheus** melakukan *HTTP GET* scraping ke target:
   - Backend API (`http://backend:5000/metrics`)
   - Prometheus itu sendiri (`http://localhost:9090/metrics`)
   - Node Exporter host (`http://node-exporter:9100/metrics`)
   - cAdvisor container (`http://cadvisor:8080/metrics`)
2. Metrik disimpan ke dalam basis data *Time-Series (TSDB)* Prometheus dan dievaluasi terhadap 10 *alert rules* (backend/error rate/latency, DB/storage, host CPU/memory/disk, exporter down).
3. **Promtail** membaca log stdout/stderr seluruh container lewat Docker socket, memberi label Compose (`service`, `container`, `stream`), lalu mengirimnya ke **Loki**.
4. Audit event backend ditulis ganda: ke tabel `audit_logs` di MariaDB **dan** stdout terstruktur `{"level":"audit",...}` sehingga ikut terkirim ke Loki.
5. Administrator membuka **Grafana** di port `3001` untuk memantau performa sistem secara visual melalui kueri *PromQL* dan menelusuri log/audit melalui *LogQL*.
