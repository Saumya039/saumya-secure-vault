import { AuthPanel } from "@/components/auth-panel";
import { VaultClient } from "@/components/vault-client";
import { getCurrentUser } from "@/lib/auth";
import { listFiles } from "@/lib/files";
import { MAX_FILE_BYTES } from "@/lib/limits";

export const dynamic = "force-dynamic";

export default async function Home() {
  const isConfigured = Boolean(process.env.DATABASE_URL);
  const user = isConfigured ? await getCurrentUser() : null;
  const files = user ? await listFiles(user.id) : [];

  return (
    <main className="app-shell">
      {user ? (
        <VaultClient initialFiles={files} maxFileBytes={MAX_FILE_BYTES} userEmail={user.email} />
      ) : (
        <AuthPanel isConfigured={isConfigured} />
      )}
    </main>
  );
}
