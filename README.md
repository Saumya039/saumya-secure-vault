# Saumya Secure Vault

A Vercel-ready encrypted file vault with email/password login and a Neon Postgres database.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Saumya039/saumya-secure-vault&project-name=saumya-secure-vault&repository-name=saumya-secure-vault&env=DATABASE_URL&envDescription=Neon%20Postgres%20connection%20string&envLink=https://vercel.com/marketplace/neon)

Target production domain: `saumyas.dev`

## Security Model

- Files are encrypted in the browser with AES-GCM before upload.
- The encryption passphrase is never sent to the server.
- The database stores encrypted ciphertext, salts, IVs, and file metadata.
- Login passwords are stored as PBKDF2-SHA256 hashes.
- Sessions use random tokens; only SHA-256 token hashes are stored in the database.

This first version stores encrypted files directly in Postgres to stay simple and free-tier friendly. Keep uploads small. For large production files, move the ciphertext to Vercel Blob and keep only metadata in Postgres.

## Vercel Setup

1. Import `https://github.com/Saumya039/saumya-secure-vault` into Vercel.
2. Keep Framework Preset as `Next.js`.
3. Add a Neon Postgres database from Vercel Marketplace.
4. Set `DATABASE_URL` in the project environment variables.
5. Deploy. The app auto-creates the needed tables on first use.
6. Add `saumyas.dev` and `www.saumyas.dev` in Vercel project domains.

For DNS, use the exact records Vercel shows in the Domains screen. Vercel currently documents apex domains with an A record of `76.76.21.21`; for `www`, use the CNAME value Vercel shows for the project.

See `HOST_ON_VERCEL.md` for the full hosting checklist.

## Local Development

Create `.env.local`:

```env
DATABASE_URL="postgres://user:password@host/db?sslmode=require"
```

Then run:

```bash
npm install
npm run dev
```
