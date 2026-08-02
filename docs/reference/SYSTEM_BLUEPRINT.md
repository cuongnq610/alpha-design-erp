# SƠ ĐỒ HỆ THỐNG V4.5.30

```text
PWA Desktop/Mobile
  ├─ Supabase Auth / JWT
  ├─ REST read under RLS
  ├─ RPC writes (transaction)
  └─ Private object storage
          │
PostgreSQL
  ├─ Tenant RLS by company_id
  ├─ Journal + lines + opening balances
  ├─ Row/advisory locks + row_version
  ├─ Append-only SHA-256 audit chain
  ├─ Period locks + reversing entries
  ├─ TT133 report functions
  ├─ Parallel reconciliation + sign-off
  └─ Backup / restore / monitoring
```

Nguồn sự thật kế toán là PostgreSQL. LocalStorage/IndexedDB chỉ phục vụ demo/offline cache, không phải sổ kế toán production.
