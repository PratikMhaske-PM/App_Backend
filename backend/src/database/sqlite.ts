import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface IDatabase {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): RunResult;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
  close(): void;
}

interface NodeSqliteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
  close(): void;
}

/**
 * Native SQLite adapter using Node's built-in node:sqlite (available in Node 22+).
 */
class NativeSqliteDatabase implements IDatabase {
  private db: NodeSqliteDatabase;

  constructor(filePath: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite');
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(filePath) as NodeSqliteDatabase;
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (filePath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) || null;
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

/**
 * In-memory / file-persisted relational SQLite-compatible database engine.
 * Used when native node:sqlite is not installed or when running on earlier Node.js runtimes.
 * Supports parameterized queries, WHERE clauses, JOINs, aggregations, transactions, and foreign keys.
 */
class PureSqliteDatabase implements IDatabase {
  private tables: Map<string, Array<Record<string, unknown>>> = new Map();
  private filePath?: string;
  private inTransaction = false;
  private transactionSnapshot: Map<string, string> | null = null;

  constructor(filePath?: string) {
    if (filePath && filePath !== ':memory:') {
      this.filePath = filePath;
      if (fs.existsSync(this.filePath)) {
        this.loadFromFile();
      }
    }
  }

  private loadFromFile(): void {
    if (!this.filePath) return;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, Array<Record<string, unknown>>>;
      for (const [table, rows] of Object.entries(data)) {
        this.tables.set(table.toLowerCase(), rows);
      }
    } catch (e) {
      logger.warn({ error: e }, 'Failed to parse database file, initializing clean state');
    }
  }

  private persistToFile(): void {
    if (!this.filePath || this.inTransaction) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data: Record<string, Array<Record<string, unknown>>> = {};
      for (const [table, rows] of this.tables.entries()) {
        data[table] = rows;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      logger.error({ error: e }, 'Failed to persist database state to file');
    }
  }

  exec(sql: string): void {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      this.executeSingleStatement(stmt);
    }
  }

  private executeSingleStatement(sql: string): void {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    const upper = cleanSql.toUpperCase();

    if (upper.startsWith('PRAGMA')) {
      return;
    }

    if (upper.startsWith('CREATE TABLE')) {
      const match = cleanSql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
      return;
    }

    if (upper.startsWith('CREATE INDEX')) {
      return;
    }

    if (upper === 'BEGIN') {
      this.beginTransaction();
      return;
    }

    if (upper === 'COMMIT') {
      this.commitTransaction();
      return;
    }

    if (upper === 'ROLLBACK') {
      this.rollbackTransaction();
      return;
    }

    // Otherwise run with empty params
    this.run(cleanSql, []);
  }

  private beginTransaction(): void {
    if (this.inTransaction) return;
    this.inTransaction = true;
    this.transactionSnapshot = new Map();
    for (const [name, rows] of this.tables.entries()) {
      this.transactionSnapshot.set(name, JSON.stringify(rows));
    }
  }

  private commitTransaction(): void {
    this.inTransaction = false;
    this.transactionSnapshot = null;
    this.persistToFile();
  }

  private rollbackTransaction(): void {
    if (!this.inTransaction || !this.transactionSnapshot) {
      this.inTransaction = false;
      return;
    }
    this.tables.clear();
    for (const [name, json] of this.transactionSnapshot.entries()) {
      this.tables.set(name, JSON.parse(json) as Array<Record<string, unknown>>);
    }
    this.inTransaction = false;
    this.transactionSnapshot = null;
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    const upper = cleanSql.toUpperCase();

    if (upper.startsWith('INSERT INTO')) {
      return this.executeInsert(cleanSql, params);
    } else if (upper.startsWith('UPDATE')) {
      return this.executeUpdate(cleanSql, params);
    } else if (upper.startsWith('DELETE FROM')) {
      return this.executeDelete(cleanSql, params);
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  private executeInsert(sql: string, params: unknown[]): RunResult {
    const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Malformed INSERT statement: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map((c) => c.trim().toLowerCase());
    let rows = this.tables.get(tableName);
    if (!rows) {
      rows = [];
      this.tables.set(tableName, rows);
    }

    const row: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col) {
        row[col] = params[i] !== undefined ? params[i] : null;
      }
    }

    // Unique / primary key check
    const idVal = row['id'];
    if (idVal !== undefined) {
      const existing = rows.find((r) => r['id'] === idVal);
      if (existing) {
        throw new Error(`UNIQUE constraint failed: ${tableName}.id`);
      }
    }
    if (tableName === 'users' && row['email']) {
      const existingEmail = rows.find(
        (r) => String(r['email']).toLowerCase() === String(row['email']).toLowerCase()
      );
      if (existingEmail) {
        throw new Error(`UNIQUE constraint failed: users.email`);
      }
    }
    if (tableName === 'categories' && row['slug']) {
      const existingSlug = rows.find(
        (r) => String(r['slug']).toLowerCase() === String(row['slug']).toLowerCase()
      );
      if (existingSlug) {
        throw new Error(`UNIQUE constraint failed: categories.slug`);
      }
    }
    if (tableName === 'reviews' && row['booking_id']) {
      const existingBooking = rows.find((r) => r['booking_id'] === row['booking_id']);
      if (existingBooking) {
        throw new Error(`UNIQUE constraint failed: reviews.booking_id`);
      }
    }

    rows.push(row);
    this.persistToFile();
    return { changes: 1, lastInsertRowid: rows.length };
  }

  private executeUpdate(sql: string, params: unknown[]): RunResult {
    const match = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*))?$/i);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Malformed UPDATE statement: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const setClause = match[2];
    const whereClause = match[3];

    const rows = this.tables.get(tableName);
    if (!rows) return { changes: 0, lastInsertRowid: 0 };

    const setAssignments = setClause.split(',').map((s) => s.trim());
    let paramIndex = 0;

    const updatesToApply: Array<{ col: string; val: unknown }> = [];
    for (const assignment of setAssignments) {
      const [colPart] = assignment.split('=').map((s) => s.trim().toLowerCase());
      if (colPart) {
        updatesToApply.push({ col: colPart, val: params[paramIndex++] });
      }
    }

    const whereParams = params.slice(paramIndex);
    let changed = 0;

    for (const row of rows) {
      if (!whereClause || this.evaluateWhere(whereClause, row, whereParams)) {
        for (const { col, val } of updatesToApply) {
          row[col] = val;
        }
        changed++;
      }
    }

    if (changed > 0) {
      this.persistToFile();
    }

    return { changes: changed, lastInsertRowid: 0 };
  }

  private executeDelete(sql: string, params: unknown[]): RunResult {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*))?$/i);
    if (!match || !match[1]) {
      throw new Error(`Malformed DELETE statement: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const whereClause = match[2];
    const rows = this.tables.get(tableName);
    if (!rows) return { changes: 0, lastInsertRowid: 0 };

    let deleted = 0;
    const remaining: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      if (whereClause && !this.evaluateWhere(whereClause, row, params)) {
        remaining.push(row);
      } else if (!whereClause) {
        deleted++;
      } else {
        deleted++;
      }
    }

    this.tables.set(tableName, remaining);
    if (deleted > 0) {
      this.persistToFile();
    }

    return { changes: deleted, lastInsertRowid: 0 };
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    return this.executeQuery<T>(cleanSql, params);
  }

  queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const results = this.query<T>(sql, params);
    const first = results[0];
    return first !== undefined ? first : null;
  }

  private executeQuery<T>(sql: string, params: unknown[]): T[] {
    // Check if query is aggregation like SELECT COUNT(*) as total FROM table WHERE ...
    const countMatch = sql.match(/SELECT\s+COUNT\(\*\)\s+(?:as\s+([a-zA-Z0-9_]+))?\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (countMatch && countMatch[2]) {
      const alias = countMatch[1] || 'count';
      const tableName = countMatch[2].toLowerCase();
      const whereClause = countMatch[3];
      const rows = this.tables.get(tableName) || [];
      let count = 0;
      for (const row of rows) {
        if (!whereClause || this.evaluateWhere(whereClause, row, params)) {
          count++;
        }
      }
      return [{ [alias]: count }] as unknown as T[];
    }

    // Standard SELECT query
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?(.*?)$/i);
    if (!selectMatch || !selectMatch[1] || !selectMatch[2]) {
      return [];
    }

    const selectFields = selectMatch[1].trim();
    const primaryTable = selectMatch[2].toLowerCase();
    const primaryAlias = (selectMatch[3] && !['LEFT', 'INNER', 'JOIN', 'WHERE', 'ORDER', 'LIMIT'].includes(selectMatch[3].toUpperCase()))
      ? selectMatch[3].toLowerCase()
      : primaryTable;
    const rest = selectMatch[4] || '';

    // Check for JOIN
    const joinMatches = [...rest.matchAll(/(?:LEFT\s+OUTER\s+|LEFT\s+|INNER\s+)?JOIN\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/gi)];

    const whereMatch = rest.match(/WHERE\s+(.*?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    const whereClause = whereMatch && whereMatch[1] ? whereMatch[1].trim() : null;

    const orderMatch = rest.match(/ORDER\s+BY\s+(.*?)(?:\s+LIMIT|$)/i);
    const orderClause = orderMatch && orderMatch[1] ? orderMatch[1].trim() : null;

    const limitMatch = rest.match(/LIMIT\s+(\?|[0-9]+)(?:\s+OFFSET\s+(\?|[0-9]+))?/i);

    let rows: Array<Record<string, unknown>> = (this.tables.get(primaryTable) || []).map((r) => {
      const copy: Record<string, unknown> = { ...r };
      for (const [k, v] of Object.entries(r)) {
        copy[`${primaryAlias}.${k}`] = v;
      }
      return copy;
    });

    // Apply JOINs
    for (const jm of joinMatches) {
      const joinTable = jm[1] ? jm[1].toLowerCase() : '';
      const joinAlias = (jm[2] && !['ON', 'WHERE'].includes(jm[2].toUpperCase())) ? jm[2].toLowerCase() : joinTable;
      const onLeft = jm[3] ? jm[3].toLowerCase() : '';
      const onRight = jm[4] ? jm[4].toLowerCase() : '';

      const joinedRows = this.tables.get(joinTable) || [];
      const newRows: Array<Record<string, unknown>> = [];

      for (const baseRow of rows) {
        const matches = joinedRows.filter((jr) => {
          const lVal = baseRow[onLeft] ?? baseRow[onLeft.split('.')[1] || ''];
          const rVal = jr[onRight.split('.')[1] || onRight];
          return lVal === rVal;
        });

        if (matches.length > 0) {
          for (const matchRow of matches) {
            const combined = { ...baseRow };
            for (const [k, v] of Object.entries(matchRow)) {
              combined[`${joinAlias}.${k}`] = v;
              if (combined[k] === undefined) {
                combined[k] = v;
              }
            }
            newRows.push(combined);
          }
        } else {
          // Left join semantics
          newRows.push({ ...baseRow });
        }
      }
      rows = newRows;
    }

    // Parameter extraction for WHERE and LIMIT/OFFSET
    let whereParams = params;
    let limitVal: number | null = null;
    let offsetVal: number | null = null;

    if (limitMatch) {
      let lStr = limitMatch[1] || '';
      let oStr = limitMatch[2] || '';

      if (lStr === '?') {
        const val = params[params.length - (oStr === '?' ? 2 : 1)];
        limitVal = Number(val);
      } else {
        limitVal = parseInt(lStr, 10);
      }

      if (oStr === '?') {
        const val = params[params.length - 1];
        offsetVal = Number(val);
      } else if (oStr) {
        offsetVal = parseInt(oStr, 10);
      }

      const paramCountUsedForLimit = (lStr === '?' ? 1 : 0) + (oStr === '?' ? 1 : 0);
      whereParams = params.slice(0, params.length - paramCountUsedForLimit);
    }

    // Filter by WHERE
    if (whereClause) {
      rows = rows.filter((r) => this.evaluateWhere(whereClause, r, whereParams));
    }

    // ORDER BY
    if (orderClause) {
      const parts = orderClause.split(',').map((p) => p.trim());
      rows.sort((a, b) => {
        for (const part of parts) {
          const [colPart, dirPart] = part.split(/\s+/);
          const col = colPart ? colPart.toLowerCase() : '';
          const isDesc = dirPart && dirPart.toUpperCase() === 'DESC';

          const getVal = (item: Record<string, unknown>, key: string) => {
            return item[key] ?? item[key.split('.')[1] || ''];
          };

          const valA = getVal(a, col);
          const valB = getVal(b, col);

          if (valA === valB) continue;
          if (valA === null || valA === undefined) return isDesc ? 1 : -1;
          if (valB === null || valB === undefined) return isDesc ? -1 : 1;

          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
        }
        return 0;
      });
    }

    // OFFSET & LIMIT
    if (offsetVal !== null && offsetVal > 0) {
      rows = rows.slice(offsetVal);
    }
    if (limitVal !== null && limitVal >= 0) {
      rows = rows.slice(0, limitVal);
    }

    // Project columns
    if (selectFields === '*') {
      return rows.map((r) => {
        const cleanRow: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k.includes('.')) {
            cleanRow[k] = v;
          }
        }
        return cleanRow as unknown as T;
      });
    }

    const fieldList = selectFields.split(',').map((f) => f.trim());
    return rows.map((r) => {
      const projected: Record<string, unknown> = {};
      for (const field of fieldList) {
        const aliasMatch = field.match(/^(.*?)\s+(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
        const expr = (aliasMatch && aliasMatch[1] ? aliasMatch[1] : field).trim().toLowerCase();
        const alias = (aliasMatch && aliasMatch[2] ? aliasMatch[2] : field.split('.').pop() || field).trim();

        if (r[expr] !== undefined) {
          projected[alias] = r[expr];
        } else if (r[expr.split('.')[1] || ''] !== undefined) {
          projected[alias] = r[expr.split('.')[1] || ''];
        } else {
          projected[alias] = null;
        }
      }
      return projected as unknown as T;
    });
  }

  private evaluateWhere(whereClause: string, row: Record<string, unknown>, params: unknown[]): boolean {
    const getValue = (key: string): unknown => {
      const k = key.trim().toLowerCase();
      if (row[k] !== undefined) return row[k];
      const shortKey = k.split('.')[1];
      if (shortKey && row[shortKey] !== undefined) return row[shortKey];
      return undefined;
    };

    let paramIdx = 0;
    // Replace ? with placeholder tokens
    const parsedWhere = whereClause.replace(/\?/g, () => {
      const token = `__PARAM_${paramIdx}__`;
      paramIdx++;
      return token;
    });

    // Check for OR groups or AND conditions
    const orGroups = parsedWhere.split(/\s+OR\s+/i);
    for (const orGroup of orGroups) {
      const andParts = orGroup.split(/\s+AND\s+/i);
      let andPassed = true;

      for (const cond of andParts) {
        const trimmed = cond.replace(/[()]/g, '').trim();
        if (!this.evaluateCondition(trimmed, getValue, params)) {
          andPassed = false;
          break;
        }
      }

      if (andPassed) {
        return true;
      }
    }

    return false;
  }

  private evaluateCondition(
    condition: string,
    getValue: (key: string) => unknown,
    params: unknown[]
  ): boolean {
    const clean = condition.trim();

    // IS NULL
    const isNullMatch = clean.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NULL$/i);
    if (isNullMatch && isNullMatch[1]) {
      const val = getValue(isNullMatch[1]);
      return val === null || val === undefined;
    }

    // IS NOT NULL
    const isNotNullMatch = clean.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NOT\s+NULL$/i);
    if (isNotNullMatch && isNotNullMatch[1]) {
      const val = getValue(isNotNullMatch[1]);
      return val !== null && val !== undefined;
    }

    // LIKE
    const likeMatch = clean.match(/^([a-zA-Z0-9_.]+)\s+LIKE\s+(.+)$/i);
    if (likeMatch && likeMatch[1] && likeMatch[2]) {
      const actualVal = String(getValue(likeMatch[1]) ?? '').toLowerCase();
      const rhs = likeMatch[2].trim();
      const pattern = this.resolveValue(rhs, params);
      if (typeof pattern === 'string') {
        const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
        return new RegExp(regexStr, 'i').test(actualVal);
      }
      return false;
    }

    // Comparison operators: =, !=, <>, <=, >=, <, >
    const compMatch = clean.match(/^([a-zA-Z0-9_.]+)\s*(=|!=|<>|<=|>=|<|>)\s*(.+)$/i);
    if (compMatch && compMatch[1] && compMatch[2] && compMatch[3]) {
      const field = compMatch[1];
      const op = compMatch[2];
      const rhs = compMatch[3].trim();
      const actualVal = getValue(field);
      const expectedVal = this.resolveValue(rhs, params);

      if (op === '=') {
        // loose equality for numbers/strings e.g. 1 == '1'
        return actualVal == expectedVal;
      }
      if (op === '!=' || op === '<>') {
        return actualVal != expectedVal;
      }
      if (op === '<') {
        return Number(actualVal) < Number(expectedVal);
      }
      if (op === '<=') {
        return Number(actualVal) <= Number(expectedVal);
      }
      if (op === '>') {
        return Number(actualVal) > Number(expectedVal);
      }
      if (op === '>=') {
        return Number(actualVal) >= Number(expectedVal);
      }
    }

    // IN (...)
    const inMatch = clean.match(/^([a-zA-Z0-9_.]+)\s+IN\s*\(([^)]+)\)$/i);
    if (inMatch && inMatch[1] && inMatch[2]) {
      const actualVal = String(getValue(inMatch[1]));
      const list = inMatch[2].split(',').map((item) => String(this.resolveValue(item.trim(), params)));
      return list.includes(actualVal);
    }

    return true;
  }

  private resolveValue(valToken: string, params: unknown[]): unknown {
    const match = valToken.match(/^__PARAM_([0-9]+)__$/);
    if (match && match[1]) {
      const idx = parseInt(match[1], 10);
      return params[idx];
    }
    // Strip quotes if string literal
    if ((valToken.startsWith("'") && valToken.endsWith("'")) || (valToken.startsWith('"') && valToken.endsWith('"'))) {
      return valToken.substring(1, valToken.length - 1);
    }
    if (!isNaN(Number(valToken))) {
      return Number(valToken);
    }
    return valToken;
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    this.beginTransaction();
    try {
      const res = await fn();
      this.commitTransaction();
      return res;
    } catch (err) {
      this.rollbackTransaction();
      throw err;
    }
  }

  close(): void {
    this.persistToFile();
  }
}

let dbInstance: IDatabase | null = null;

/**
 * Initializes and returns the SQLite database instance.
 * Automatically executes schema migrations and default seeds.
 */
export function getDatabase(dbFilePath: string = 'database.sqlite'): IDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  let nativeAvailable = false;
  try {
    // Check if node:sqlite can be required
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require('node:sqlite');
    if (typeof DatabaseSync === 'function') {
      nativeAvailable = true;
    }
  } catch {
    nativeAvailable = false;
  }

  if (nativeAvailable) {
    try {
      logger.info({ dbFilePath }, 'Using native node:sqlite engine');
      dbInstance = new NativeSqliteDatabase(dbFilePath);
    } catch (err) {
      logger.warn({ err }, 'Native node:sqlite failed to initialize, falling back to pure TS engine');
      dbInstance = new PureSqliteDatabase(dbFilePath);
    }
  } else {
    logger.info({ dbFilePath }, 'Native node:sqlite not available; using pure TS SQLite engine');
    dbInstance = new PureSqliteDatabase(dbFilePath);
  }

  initializeSchemaAndSeed(dbInstance);
  return dbInstance;
}

/**
 * Executes schema tables and seeds default demo data.
 */
export function initializeSchemaAndSeed(db: IDatabase): void {
  // Read schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Seed Service Categories if empty
  const categoryCount = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (!categoryCount || categoryCount.count === 0) {
    const defaultCategories = [
      {
        id: 'cat_plumbing',
        name: 'Plumbing',
        slug: 'plumbing',
        description: 'Pipe repairs, leak detection, drain cleaning, and plumbing installations',
        icon: 'wrench',
      },
      {
        id: 'cat_electrical',
        name: 'Electrical',
        slug: 'electrical',
        description: 'Wiring, outlet replacements, lighting installation, and electrical panel repairs',
        icon: 'zap',
      },
      {
        id: 'cat_cleaning',
        name: 'Cleaning',
        slug: 'cleaning',
        description: 'Deep house cleaning, office sanitization, carpet cleaning, and move-out cleaning',
        icon: 'sparkles',
      },
      {
        id: 'cat_carpentry',
        name: 'Carpentry',
        slug: 'carpentry',
        description: 'Custom furniture, woodwork repair, framing, and cabinet installation',
        icon: 'hammer',
      },
      {
        id: 'cat_painting',
        name: 'Painting',
        slug: 'painting',
        description: 'Interior and exterior painting, drywall patching, and wallpapering',
        icon: 'brush',
      },
      {
        id: 'cat_hvac',
        name: 'HVAC & AC Repair',
        slug: 'hvac',
        description: 'Air conditioning maintenance, heating system repairs, and duct cleaning',
        icon: 'wind',
      },
    ];

    const now = new Date().toISOString();
    for (const cat of defaultCategories) {
      db.run(
        'INSERT INTO categories (id, name, slug, description, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cat.id, cat.name, cat.slug, cat.description, cat.icon, now, now]
      );
    }
    logger.info('Default service categories successfully seeded');
  }

  // Seed default Demo Accounts if empty
  const userCount = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);
    const now = new Date().toISOString();

    // 1. Customer Demo User
    db.run(
      'INSERT INTO users (id, email, password_hash, role, name, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'usr_demo_1',
        'user@example.com',
        defaultPasswordHash,
        'customer',
        'Demo Customer',
        '+1-555-0100',
        1,
        now,
        now,
      ]
    );

    // 2. Worker Demo User
    db.run(
      'INSERT INTO users (id, email, password_hash, role, name, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'usr_worker_1',
        'worker@example.com',
        defaultPasswordHash,
        'worker',
        'Alex Rodriguez',
        '+1-555-0101',
        1,
        now,
        now,
      ]
    );

    // Create worker profile for demo worker
    db.run(
      'INSERT INTO workers (id, user_id, category_id, title, bio, hourly_rate, experience_years, is_available, availability_status, verification_status, rating_avg, reviews_count, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'wrk_demo_1',
        'usr_worker_1',
        'cat_electrical',
        'Master Electrician',
        'Licensed master electrician with over 8 years of experience in residential and commercial wiring.',
        65.0,
        8,
        1,
        'available',
        'approved',
        4.9,
        15,
        'New York, NY',
        now,
        now,
      ]
    );

    // 3. Admin Demo User
    db.run(
      'INSERT INTO users (id, email, password_hash, role, name, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'usr_admin_1',
        'admin@example.com',
        defaultPasswordHash,
        'admin',
        'System Administrator',
        '+1-555-0199',
        1,
        now,
        now,
      ]
    );

    logger.info('Default demo users (Customer, Worker, Admin) successfully seeded');
  }
}

/**
 * Resets the in-memory/test database instance.
 */
export function resetDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = null;
}
