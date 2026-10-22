import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const connection=process.env.INSPECTION_TEST_DATABASE_URL;
if (!connection) throw new Error('Provide an isolated localhost inspection_test database.');
const parsed=new URL(connection);
if (!['localhost','127.0.0.1'].includes(parsed.hostname) || parsed.pathname!=='/inspection_test') throw new Error('Remote/non-test database rejected.');
const name=`inspection_migration_${randomUUID().replaceAll('-','')}`;
const filename=join(tmpdir(),`${name}.sql`);
const sql=readFileSync(new URL('../../backend/prisma/migrations/20261012120000_owned_inspections/migration.sql',import.meta.url),'utf8');
writeFileSync(filename,`CREATE SCHEMA "${name}";\nSET search_path TO "${name}";\nCREATE TABLE rental_bookings (id TEXT PRIMARY KEY);\n${sql}`);
const db=new PrismaClient({datasources:{db:{url:connection}}});
try {
  const require=createRequire(import.meta.url);
  const result=spawnSync(process.execPath,[require.resolve('prisma'), 'db','execute','--file',filename,'--url',connection],{stdio:'inherit',env:{...process.env,DATABASE_URL:connection,DIRECT_URL:connection}});
  if (result.error) throw result.error;
  assert.equal(result.status,0);
  const tables=await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = ${name}`;
  assert.deepEqual(tables.map(row=>row.table_name).sort(),['inspection_events','inspection_images','rental_bookings','rental_inspections']);
  console.log('PASS: owned inspection SQL migration executes with its booking foreign key.');
} finally { unlinkSync(filename); await db.$disconnect(); }
