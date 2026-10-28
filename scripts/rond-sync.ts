/**
 * Hourly rond.ir sync worker: re-fetches every listing, marks listings that
 * disappeared from rond.ir as inactive, refreshes rond.ir's "نوع رند" labels
 * once a day and re-learns the price model after that.
 *
 * Usage:  npm run rond:sync            # keeps running, one full sync per hour
 *         npm run rond:sync -- --once  # one sync, then exit (for cron/systemd timers)
 * Env:    ROND_SYNC_INTERVAL_MIN=60  ROND_SYNC_LABELS_HOURS=24
 *         ROND_SYNC_PRECODES=0912,0919 (default: all MCI)  ROND_SYNC_DELAY=400
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { prisma } from "../lib/db";
import { MCI_PRECODES } from "../lib/numbers/algorithms";
import { collectLabels, collectListings, deactivateMissing } from "../lib/rond/collect";
import { sleep } from "../lib/rond/client";

const INTERVAL_MS = Number(process.env.ROND_SYNC_INTERVAL_MIN ?? 60) * 60_000;
const LABELS_MS = Number(process.env.ROND_SYNC_LABELS_HOURS ?? 24) * 3_600_000;
const PRECODES = process.env.ROND_SYNC_PRECODES?.split(",").map((s) => s.trim()) ?? MCI_PRECODES;
const DELAY = Number(process.env.ROND_SYNC_DELAY ?? 400);
const ONCE = process.argv.includes("--once");
const LOCK_ID = 727_001;

const log = (line: string) => console.log(`[${new Date().toISOString()}] ${line}`);

async function labelsDue(): Promise<boolean> {
  const last = await prisma.syncRun.findFirst({
    where: { status: "ok", withLabels: true },
    orderBy: { startedAt: "desc" },
  });
  return !last || Date.now() - last.startedAt.getTime() >= LABELS_MS;
}

async function syncOnce() {
  const withLabels = await labelsDue();
  const run = await prisma.syncRun.create({ data: { withLabels } });
  const startedAt = run.startedAt;
  log(`sync started (${PRECODES.length} pre-codes${withLabels ? ", with labels" : ""})`);
  const opts = { precodes: PRECODES, size: 100, delay: DELAY, maxPages: 0, log };
  try {
    const seenBy = await collectListings(opts);
    const seen = Object.values(seenBy).reduce((a, b) => a + b, 0);
    // Only after every pre-code finished: whatever was not seen is gone from rond.ir.
    const deactivated = await deactivateMissing(PRECODES, startedAt);
    log(`listings: ${seen} seen, ${deactivated} no longer on rond.ir`);

    if (withLabels) {
      if (await collectLabels(opts)) {
        log("labels refreshed, re-learning the price model");
        const learn = spawnSync("npx", ["tsx", "scripts/rond-learn.ts", "--backtest=0"], { stdio: "inherit" });
        if (learn.status !== 0) log("rond:learn failed (the previous model stays in use)");
      } else {
        log("no algorithm filter field known (run `npm run rond:discover`), labels skipped");
      }
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "ok", finishedAt: new Date(), seen, deactivated } });
    log(`sync finished in ${Math.round((Date.now() - startedAt.getTime()) / 60_000)} min`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), error } });
    log(`sync failed: ${error}`);
  }
}

async function main() {
  // One worker at a time, even if it is started twice.
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  const { rows } = await lock.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_ID]);
  if (!rows[0].ok) {
    log("another rond:sync worker is already running, exiting");
    await lock.end();
    return;
  }
  // Runs left "running" by a crashed worker are closed out.
  await prisma.syncRun.updateMany({ where: { status: "running" }, data: { status: "failed", error: "interrupted" } });

  // The interrupted run is closed out as "failed" on the next start.
  const stop = () => {
    log("stopped");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  for (;;) {
    const started = Date.now();
    await syncOnce();
    if (ONCE) break;
    // Next sync starts one interval after this one started; a sync longer than
    // the interval is followed by the next one right away (never overlapping).
    const wait = Math.max(0, started + INTERVAL_MS - Date.now());
    log(`next sync in ${Math.round(wait / 60_000)} min`);
    await sleep(wait);
  }
  await lock.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
