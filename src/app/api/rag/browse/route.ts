import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || homedir();

  try {
    const entries = await readdir(path, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: join(path, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Get parent directory
    const parent = join(path, "..");
    const parentStat = await stat(parent).catch(() => null);

    return NextResponse.json({
      current: path,
      parent: parentStat ? parent : null,
      directories: dirs,
    });
  } catch {
    return NextResponse.json(
      { error: `Cannot read directory: ${path}` },
      { status: 400 }
    );
  }
}
