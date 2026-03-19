import { Hono } from "hono";
import type { ServiceScope } from "@d2/di";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { IGetFileMetadataKey, IGetStorageObjectKey, buildVariantStorageKey } from "@d2/files-app";
import { SCOPE_KEY } from "../context-keys.js";

/**
 * Download routes — file download proxy via MinIO.
 *
 * `GET /files/:fileId/:variantName` — streams file content from storage.
 *
 * Sets aggressive caching for ready files (immutable content-addressable keys).
 */
export function createDownloadRoutes(): Hono {
  const app = new Hono();

  app.get("/files/:fileId/:variantName", async (c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (c as any).get(SCOPE_KEY) as ServiceScope;
    const { fileId, variantName } = c.req.param();

    // Look up file metadata
    const metadataHandler = scope.resolve(IGetFileMetadataKey);
    const metaResult = await metadataHandler.handleAsync({ fileId });

    if (!metaResult.success || !metaResult.data) {
      return c.json(
        {
          success: false,
          statusCode: metaResult.statusCode,
          messages: metaResult.messages,
          data: null,
        },
        metaResult.statusCode as ContentfulStatusCode,
      );
    }

    const file = metaResult.data.file;

    // Verify the requested variant exists (variant identifier is `size`)
    const variant = file.variants?.find((v) => v.size === variantName);
    if (!variant) {
      return c.json(
        { success: false, statusCode: 404, messages: ["Variant not found."], data: null },
        404 as ContentfulStatusCode,
      );
    }

    // Only serve ready files
    if (file.status !== "ready") {
      return c.json(
        {
          success: false,
          statusCode: 404,
          messages: ["File is not ready for download."],
          data: null,
        },
        404 as ContentfulStatusCode,
      );
    }

    // Build storage key and stream from MinIO
    const storageKey = buildVariantStorageKey(
      {
        id: file.id,
        contextKey: file.contextKey,
        relatedEntityId: file.relatedEntityId,
      },
      variantName,
      variant.contentType,
    );

    const storageHandler = scope.resolve(IGetStorageObjectKey);
    const storageResult = await storageHandler.handleAsync({ key: storageKey });

    if (!storageResult.success || !storageResult.data) {
      return c.json(
        { success: false, statusCode: 404, messages: ["File not found in storage."], data: null },
        404 as ContentfulStatusCode,
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", variant.contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Always use `attachment` to prevent XSS via uploaded SVG/HTML.
    // Sanitize filename: strip characters that could cause header injection.
    const safeName =
      (file.displayName ?? "download").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255) || "download";
    headers.set("Content-Disposition", `attachment; filename="${safeName}"`);

    return new Response(new Uint8Array(storageResult.data.buffer), {
      status: 200,
      headers,
    });
  });

  return app;
}
