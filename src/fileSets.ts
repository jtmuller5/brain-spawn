import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface FileSet {
  id: string;
  name: string;
  description: string;
  files: string[];
  createdAt: string;
  updatedAt: string;
}

const FILE_SETS_PATH = ".brain-spawn/file-sets.json";

export function loadFileSets(workspaceRoot: string): FileSet[] {
  const filePath = path.join(workspaceRoot, FILE_SETS_PATH);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveFileSets(workspaceRoot: string, sets: FileSet[]): void {
  const filePath = path.join(workspaceRoot, FILE_SETS_PATH);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(sets, null, 2) + "\n");
}

export function addFileSet(
  workspaceRoot: string,
  name: string,
  description: string,
  files: string[]
): FileSet {
  const sets = loadFileSets(workspaceRoot);
  const fileSet: FileSet = {
    id: crypto.randomBytes(3).toString("hex"),
    name,
    description,
    files,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sets.push(fileSet);
  saveFileSets(workspaceRoot, sets);
  return fileSet;
}

export function updateFileSet(
  workspaceRoot: string,
  id: string,
  updates: { name?: string; description?: string }
): void {
  const sets = loadFileSets(workspaceRoot);
  const set = sets.find((s) => s.id === id);
  if (!set) {
    return;
  }
  if (updates.name !== undefined) {
    set.name = updates.name;
  }
  if (updates.description !== undefined) {
    set.description = updates.description;
  }
  set.updatedAt = new Date().toISOString();
  saveFileSets(workspaceRoot, sets);
}

export function deleteFileSet(workspaceRoot: string, id: string): void {
  const sets = loadFileSets(workspaceRoot);
  const filtered = sets.filter((s) => s.id !== id);
  saveFileSets(workspaceRoot, filtered);
}
