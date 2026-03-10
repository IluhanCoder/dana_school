import { Storage } from "@google-cloud/storage";

type UploadResult = {
  url: string;
  storagePath: string;
};

export type ListedStorageFile = {
  storagePath: string;
  size: number;
  updatedAt: Date;
  contentType: string;
};

class GoogleStorageService {
  private readonly bucketName: string;
  private readonly storage: Storage;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || "";

    const hasInlineCredentials =
      !!process.env.GCS_CLIENT_EMAIL && !!process.env.GCS_PRIVATE_KEY;

    this.storage = new Storage(
      hasInlineCredentials
        ? {
            projectId: process.env.GCS_PROJECT_ID,
            credentials: {
              client_email: process.env.GCS_CLIENT_EMAIL,
              private_key: (process.env.GCS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
            },
          }
        : {
            projectId: process.env.GCS_PROJECT_ID,
          }
    );
  }

  private ensureConfigured() {
    if (!this.bucketName) {
      throw new Error("GCS не налаштовано: потрібна змінна GCS_BUCKET_NAME");
    }
  }

  private getSignedUrlExpiryMs(): number {
    return 7 * 24 * 60 * 60 * 1000;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "");
  }

  async uploadPdf(params: {
    buffer: Buffer;
    subjectId: string;
    originalName: string;
  }): Promise<UploadResult> {
    this.ensureConfigured();

    const bucket = this.storage.bucket(this.bucketName);
    const safeName = this.sanitizeFileName(params.originalName || "material.pdf");
    const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const storagePath = `subjects/${params.subjectId}/materials/${uniquePrefix}-${safeName}`;
    const file = bucket.file(storagePath);

    await file.save(params.buffer, {
      resumable: false,
      metadata: {
        contentType: "application/pdf",
        cacheControl: "private, max-age=3600",
      },
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + this.getSignedUrlExpiryMs(),
      version: "v4",
    });

    return { url, storagePath };
  }

  async getSignedReadUrl(storagePath: string): Promise<string> {
    this.ensureConfigured();
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storagePath);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + this.getSignedUrlExpiryMs(),
      version: "v4",
    });

    return url;
  }

  async downloadToBuffer(storagePath: string): Promise<Buffer> {
    this.ensureConfigured();
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    return buffer;
  }

  async deleteFile(storagePath: string): Promise<void> {
    this.ensureConfigured();
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storagePath);
    await file.delete({ ignoreNotFound: true });
  }

  async listFilesByPrefix(prefix: string): Promise<string[]> {
    this.ensureConfigured();
    const bucket = this.storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({ prefix });
    return files
      .map((file) => file.name)
      .filter((name) => !!name && !name.endsWith("/"));
  }

  async listFilesByPrefixDetailed(prefix: string): Promise<ListedStorageFile[]> {
    this.ensureConfigured();
    const bucket = this.storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({ prefix });

    return files
      .map((file) => {
        const rawSize = Number(file.metadata?.size || 0);
        const updated = file.metadata?.updated ? new Date(file.metadata.updated) : new Date();
        return {
          storagePath: file.name,
          size: Number.isFinite(rawSize) ? rawSize : 0,
          updatedAt: Number.isNaN(updated.getTime()) ? new Date() : updated,
          contentType: file.metadata?.contentType || "application/octet-stream",
        };
      })
      .filter((item) => !!item.storagePath && !item.storagePath.endsWith("/"));
  }
}

export default new GoogleStorageService();
