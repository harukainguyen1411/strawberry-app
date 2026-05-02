#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseFrontmatter, safeReaddir, isDir } from './generate-projects.mjs';

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
      for (const entry of safeReaddir(stateDir)) {
        const entryPath = join(stateDir, entry);
        if (entry.endsWith('.md')) {
          collectPlan(plans, entryPath, { raspberryDir, concern, state });
        } else if (isDir(entryPath)) {
          for (const sub of safeReaddir(entryPath)) {
            if (!sub.endsWith('.md')) continue;
            collectPlan(plans, join(entryPath, sub), { raspberryDir, concern, state });
          }
        }
      }
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ plans, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return plans;
}

function collectPlan(plans, filePath, { raspberryDir, concern, state }) {
  const text = readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) return;
  const slug = fm.slug ?? basename(filePath, '.md');
  plans.push({
    slug,
    state,
    concern: fm.concern ?? concern,
    project: fm.project ?? null,
    path: relative(raspberryDir, filePath),
  });
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const raspberryDir = process.env.RASPBERRY_DIR || join(homedir(), 'Documents', 'Personal', 'raspberry');
  const outPath = process.env.PLANS_OUT || join(__dirname, '..', '..', 'dashboards', 'usage-dashboard', 'plans.json');
  const plans = await generatePlans({ raspberryDir, outPath });
  process.stdout.write(`plans.json written: ${plans.length} plans → ${outPath}\n`);
}
