#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function parseFrontmatter(text) {
  text = text.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawVal] = m;
    let val = rawVal.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    fm[key] = val;
  }
  return fm;
}

export async function generateProjects({ raspberryDir, outPath }) {
  const projectsRoot = join(raspberryDir, 'projects');
  const projects = [];
  for (const concern of safeReaddir(projectsRoot)) {
    const concernDir = join(projectsRoot, concern);
    if (!isDir(concernDir)) continue;
    for (const slug of safeReaddir(concernDir)) {
      const readmePath = join(concernDir, slug, 'README.md');
      if (!isFile(readmePath)) continue;
      const text = readFileSync(readmePath, 'utf8');
      const fm = parseFrontmatter(text);
      if (!fm || !fm.slug) {
        process.stderr.write(`Skipping ${readmePath}: no frontmatter or no slug\n`);
        continue;
      }
      projects.push({
        slug:    fm.slug,
        name:    fm.name    ?? fm.slug,
        concern: fm.concern ?? concern,
        product: fm.product ?? null,
        aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
      });
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ projects, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return projects;
}

export function safeReaddir(p) { try { return readdirSync(p); } catch { return []; } }
export function isDir(p)       { try { return statSync(p).isDirectory(); } catch { return false; } }
export function isFile(p)      { try { return statSync(p).isFile();      } catch { return false; } }

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const raspberryDir = process.env.RASPBERRY_DIR || join(homedir(), 'Documents', 'Personal', 'raspberry');
  const outPath = process.env.PROJECTS_OUT || join(__dirname, '..', '..', 'dashboards', 'usage-dashboard', 'projects.json');
  const projects = await generateProjects({ raspberryDir, outPath });
  process.stdout.write(`projects.json written: ${projects.length} projects → ${outPath}\n`);
}
