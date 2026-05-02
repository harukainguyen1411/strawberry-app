#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseFrontmatter } from './generate-projects.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATES = ['draft', 'active', 'done', 'archived'];

export async function generatePlans({ raspberryDir, outPath }) {
  const plansRoot = join(raspberryDir, 'plans');
  const plans = [];
  for (const concern of safeReaddir(plansRoot)) {
    const concernDir = join(plansRoot, concern);
    if (!isDir(concernDir)) continue;
    for (const state of STATES) {
      const stateDir = join(concernDir, state);
      if (!isDir(stateDir)) continue;
      for (const fname of safeReaddir(stateDir)) {
        if (!fname.endsWith('.md')) continue;
        const filePath = join(stateDir, fname);
        const text = readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(text);
        if (!fm) continue;
        const slug = fm.slug ?? basename(fname, '.md');
        plans.push({
          slug,
          state,
          concern: fm.concern ?? concern,
          project: fm.project ?? null,
          path: filePath.replace(raspberryDir + '/', ''),
        });
      }
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ plans, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return plans;
}

function safeReaddir(p) { try { return readdirSync(p); } catch { return []; } }
function isDir(p)       { try { return statSync(p).isDirectory(); } catch { return false; } }

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const raspberryDir = process.env.RASPBERRY_DIR || join(homedir(), 'Documents', 'Personal', 'raspberry');
  const outPath = process.env.PLANS_OUT || join(__dirname, '..', '..', 'dashboards', 'usage-dashboard', 'plans.json');
  const plans = await generatePlans({ raspberryDir, outPath });
  process.stdout.write(`plans.json written: ${plans.length} plans → ${outPath}\n`);
}
