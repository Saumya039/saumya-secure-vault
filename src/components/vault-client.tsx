"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Download,
  FileKey2,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { EncryptedVaultFile, VaultFileSummary } from "@/lib/files";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/limits";

type VaultClientProps = {
  initialFiles: VaultFileSummary[];
  maxFileBytes: number;
  userEmail: string;
};

type Status = {
  kind: "idle" | "success" | "error";
  text: string;
};

export function VaultClient({ initialFiles, maxFileBytes, userEmail }: VaultClientProps) {
  const [files, setFiles] = useState(initialFiles);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPassphrase, setUploadPassphrase] = useState("");
  const [downloadPassphrase, setDownloadPassphrase] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.sizeBytes, 0), [files]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "idle", text: "" });

    if (!selectedFile) {
      setStatus({ kind: "error", text: "Choose a file first." });
      return;
    }

    if (selectedFile.size > maxFileBytes) {
      setStatus({ kind: "error", text: `Maximum file size is ${formatBytes(maxFileBytes)}.` });
      return;
    }

    if (uploadPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      setStatus({ kind: "error", text: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.` });
      return;
    }

    setBusyAction("upload");

    try {
      const encrypted = await encryptFile(selectedFile, uploadPassphrase);
      const response = await fetch("/api/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(encrypted),
      });

      const payload = (await response.json()) as { file?: VaultFileSummary; error?: string };

      if (!response.ok || !payload.file) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      setFiles((current) => [payload.file as VaultFileSummary, ...current]);
      setSelectedFile(null);
      setUploadPassphrase("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatus({ kind: "success", text: "Encrypted upload complete." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshFiles() {
    setBusyAction("refresh");
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch("/api/files");
      const payload = (await response.json()) as { files?: VaultFileSummary[]; error?: string };

      if (!response.ok || !payload.files) {
        throw new Error(payload.error ?? "Refresh failed.");
      }

      setFiles(payload.files);
      setStatus({ kind: "success", text: "Vault refreshed." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Refresh failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadFile(fileId: string) {
    if (downloadPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      setStatus({ kind: "error", text: `Enter a ${MIN_PASSPHRASE_LENGTH}+ character passphrase to decrypt.` });
      return;
    }

    setBusyAction(fileId);
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch(`/api/files/${fileId}`);
      const payload = (await response.json()) as { file?: EncryptedVaultFile; error?: string };

      if (!response.ok || !payload.file) {
        throw new Error(payload.error ?? "Download failed.");
      }

      const decrypted = await decryptFile(payload.file, downloadPassphrase);
      const blob = new Blob([decrypted], { type: payload.file.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.file.name;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", text: "File decrypted." });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Wrong passphrase or damaged file.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function removeFile(fileId: string) {
    setBusyAction(`delete-${fileId}`);
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed.");
      }

      setFiles((current) => current.filter((file) => file.id !== fileId));
      setStatus({ kind: "success", text: "File deleted." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <section className="vault-layout" aria-labelledby="vault-title">
      <header className="vault-header">
        <div>
          <p className="eyebrow">saumyas.dev</p>
          <h1 id="vault-title">Secure Vault</h1>
        </div>
        <div className="header-actions">
          <span className="account-pill">{userEmail}</span>
          <button className="icon-button" onClick={logout} title="Sign out" type="button">
            {busyAction === "logout" ? <Loader2 className="spin" size={18} /> : <LogOut size={18} />}
          </button>
        </div>
      </header>

      <div className="vault-grid">
        <form className="upload-panel" onSubmit={handleUpload}>
          <div className="panel-heading">
            <ShieldCheck size={22} />
            <h2>Encrypt Upload</h2>
          </div>

          <label className="file-drop">
            <UploadCloud size={22} />
            <span>{selectedFile ? selectedFile.name : "Choose file"}</span>
            <input
              ref={fileInputRef}
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <label className="field">
            <span>Encryption passphrase</span>
            <input
              autoComplete="new-password"
              minLength={MIN_PASSPHRASE_LENGTH}
              onChange={(event) => setUploadPassphrase(event.target.value)}
              type="password"
              value={uploadPassphrase}
            />
          </label>

          <div className="metric-row">
            <span>Limit</span>
            <strong>{formatBytes(maxFileBytes)}</strong>
          </div>
          <div className="metric-row">
            <span>Selected</span>
            <strong>{selectedFile ? formatBytes(selectedFile.size) : "0 B"}</strong>
          </div>

          <button className="primary-action" disabled={busyAction === "upload"} type="submit">
            {busyAction === "upload" ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
            Upload encrypted file
          </button>
        </form>

        <section className="files-panel">
          <div className="panel-toolbar">
            <div>
              <div className="panel-heading compact">
                <FileKey2 size={20} />
                <h2>Files</h2>
              </div>
              <p className="panel-stat">
                {files.length} items - {formatBytes(totalBytes)}
              </p>
            </div>
            <button className="icon-button" onClick={refreshFiles} title="Refresh" type="button">
              {busyAction === "refresh" ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
          </div>

          <label className="field compact-field">
            <span>Decrypt passphrase</span>
            <input
              autoComplete="current-password"
              minLength={MIN_PASSPHRASE_LENGTH}
              onChange={(event) => setDownloadPassphrase(event.target.value)}
              type="password"
              value={downloadPassphrase}
            />
          </label>

          <div className="file-list">
            {files.length ? (
              files.map((file) => (
                <article className="file-row" key={file.id}>
                  <div className="file-icon" aria-hidden="true">
                    <FileKey2 size={18} />
                  </div>
                  <div className="file-main">
                    <h3>{file.name}</h3>
                    <p>
                      {formatBytes(file.sizeBytes)} - {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      onClick={() => downloadFile(file.id)}
                      title="Decrypt and download"
                      type="button"
                    >
                      {busyAction === file.id ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => removeFile(file.id)}
                      title="Delete"
                      type="button"
                    >
                      {busyAction === `delete-${file.id}` ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <FileKey2 size={28} />
                <p>No files yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {status.text ? <p className={`toast ${status.kind}`}>{status.text}</p> : null}
    </section>
  );
}

async function encryptFile(file: File, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plainBytes = await file.arrayBuffer();
  const cipherBytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);

  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    encryptedSizeBytes: cipherBytes.byteLength,
    cipherText: arrayBufferToBase64(cipherBytes),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  };
}

async function decryptFile(file: EncryptedVaultFile, passphrase: string) {
  const salt = base64ToArrayBuffer(file.salt);
  const iv = base64ToArrayBuffer(file.iv);
  const cipherBytes = base64ToArrayBuffer(file.cipherText);
  const key = await deriveKey(passphrase, new Uint8Array(salt));

  return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, cipherBytes);
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 310_000,
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
