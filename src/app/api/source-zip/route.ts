import { NextResponse } from "next/server";
import JSZip from "jszip";
import { promises as fs } from "fs";
import path from "path";

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", ".turbo"]);
const EXCLUDE_FILES = new Set([".env", "tsconfig.tsbuildinfo", "next-env.d.ts"]);

async function listFiles(dir: string, base = ""): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name) || EXCLUDE_FILES.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.join(base, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFiles(full, rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

// GET /api/source-zip - download source code (sementara, untuk update GitHub)
export async function GET() {
  try {
    const root = process.cwd();
    const files = await listFiles(root);
    const zip = new JSZip();
    for (const f of files) {
      try {
        zip.file(f, await fs.readFile(path.join(root, f)));
      } catch {
        /* skip */
      }
    }
    const buf = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="gudangpro-latest.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat arsip" }, { status: 500 });
  }
}
