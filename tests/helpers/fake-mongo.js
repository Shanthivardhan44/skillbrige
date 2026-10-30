// A small in-memory stand-in for the parts of the MongoDB Node driver that SkillBridge uses.
// It lets the HTTP tests run without a database server. It is NOT a MongoDB implementation:
// run the application against a real MongoDB (local or Atlas) before relying on database behavior.
import { ObjectId } from 'mongodb';

const isObjectId = (value) => value instanceof ObjectId;
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value) && !isObjectId(value) && !(value instanceof Date);

function clone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (isObjectId(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function same(a, b) {
  if (isObjectId(a) || isObjectId(b)) return String(a) === String(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => same(item, b[index]));
  return a === b;
}

// Reads a dotted path; arrays along the way fan out like MongoDB's query semantics.
function readPath(doc, path) {
  let values = [doc];
  for (const key of path.split('.')) {
    values = values.flatMap((value) => {
      if (value === null || value === undefined) return [];
      if (Array.isArray(value)) return value.flatMap((item) => (item === null || item === undefined ? [] : [item[key]]));
      return [value[key]];
    });
  }
  return values;
}

function matches(doc, filter) {
  return Object.entries(filter).every(([path, expected]) => {
    const found = readPath(doc, path).flatMap((value) => (Array.isArray(value) ? [value, ...value] : [value]));
    if (isPlainObject(expected) && '$in' in expected) return found.some((value) => expected.$in.some((option) => same(value, option)));
    if (expected === null) return found.length === 0 || found.some((value) => value === null || value === undefined);
    return found.some((value) => same(value, expected));
  });
}

function compare(a, b) {
  const left = a instanceof Date ? a.getTime() : isObjectId(a) ? String(a) : a;
  const right = b instanceof Date ? b.getTime() : isObjectId(b) ? String(b) : b;
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  return left < right ? -1 : 1;
}

function setPath(doc, path, value) {
  const parts = path.split('.');
  let target = doc;
  for (const key of parts.slice(0, -1)) {
    if (target[key] === undefined) target[key] = {};
    target = target[key];
  }
  target[parts.at(-1)] = value;
}

// Handles `array.$.field`: updates the array element that the filter's `array.field` condition matched.
function applyPositionalSet(doc, filter, path, value) {
  const [arrayName, , ...rest] = path.split('.');
  const queryKey = Object.keys(filter).find((key) => key.startsWith(`${arrayName}.`));
  const field = queryKey.slice(arrayName.length + 1);
  const element = doc[arrayName].find((item) => same(item[field], filter[queryKey]));
  setPath(element, rest.join('.'), value);
}

// --- aggregation-pipeline expressions (only what the app uses) -------------------------------
function evaluate(expression, doc, now) {
  if (typeof expression === 'string') {
    if (expression === '$$NOW') return now;
    if (expression.startsWith('$')) return readPath(doc, expression.slice(1))[0];
    return expression;
  }
  if (Array.isArray(expression)) return expression.map((item) => evaluate(item, doc, now));
  if (isPlainObject(expression)) {
    const [operator] = Object.keys(expression);
    const args = expression[operator];
    const list = () => (Array.isArray(args) ? args : [args]).map((item) => evaluate(item, doc, now));
    switch (operator) {
      case '$ifNull': { const [value, fallback] = list(); return value ?? fallback; }
      case '$setUnion': {
        const result = [];
        for (const item of list().flat()) if (!result.some((existing) => same(existing, item))) result.push(item);
        return result;
      }
      case '$setIntersection': { const [a, b] = list(); return a.filter((item) => b.some((other) => same(item, other))); }
      case '$size': return list()[0].length;
      case '$multiply': return list().reduce((product, item) => product * item, 1);
      case '$divide': { const [a, b] = list(); return a / b; }
      case '$floor': return Math.floor(list()[0]);
      case '$toInt': return Math.trunc(list()[0]);
      case '$min': return Math.min(...list());
      default: throw new Error(`Fake MongoDB: unsupported expression ${operator}`);
    }
  }
  return expression;
}

function applyUpdate(doc, update, { filter, inserting, now }) {
  if (Array.isArray(update)) {
    for (const stage of update) {
      if (!stage.$set) throw new Error('Fake MongoDB: only $set pipeline stages are supported.');
      const computed = Object.fromEntries(Object.entries(stage.$set).map(([key, expression]) => [key, evaluate(expression, doc, now)]));
      Object.assign(doc, computed);
    }
    return;
  }
  for (const [operator, fields] of Object.entries(update)) {
    if (operator === '$set') {
      for (const [path, value] of Object.entries(fields)) {
        if (path.includes('.$.')) applyPositionalSet(doc, filter, path, clone(value));
        else setPath(doc, path, clone(value));
      }
    } else if (operator === '$setOnInsert') {
      if (inserting) for (const [path, value] of Object.entries(fields)) setPath(doc, path, clone(value));
    } else {
      throw new Error(`Fake MongoDB: unsupported update operator ${operator}`);
    }
  }
}

class FakeCursor {
  constructor(docs) { this.docs = docs; }
  sort(spec) {
    const entries = Object.entries(spec);
    this.docs = [...this.docs].sort((a, b) => {
      for (const [field, direction] of entries) {
        const result = compare(readPath(a, field)[0], readPath(b, field)[0]);
        if (result) return result * direction;
      }
      return 0;
    });
    return this;
  }
  limit(count) { this.docs = this.docs.slice(0, count); return this; }
  async toArray() { return this.docs.map(clone); }
}

class FakeCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
    this.uniqueIndexes = [];
  }
  async createIndex(keys, options = {}) {
    if (options.unique) this.uniqueIndexes.push(Object.keys(keys));
    return options.name || Object.keys(keys).join('_');
  }
  assertUnique(candidate, ignore) {
    for (const keys of this.uniqueIndexes) {
      const clash = this.docs.some((doc) => doc !== ignore && keys.every((key) => same(doc[key], candidate[key])));
      if (clash) {
        const error = new Error(`E11000 duplicate key error on ${this.name} (${keys.join(', ')})`);
        error.code = 11000;
        throw error;
      }
    }
  }
  async insertOne(doc) {
    const stored = clone(doc);
    stored._id ??= new ObjectId();
    this.assertUnique(stored);
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }
  async findOne(filter = {}, options = {}) {
    let found = this.docs.filter((doc) => matches(doc, filter));
    if (options.sort) found = new FakeCursor(found).sort(options.sort).docs;
    return found[0] ? clone(found[0]) : null;
  }
  find(filter = {}) { return new FakeCursor(this.docs.filter((doc) => matches(doc, filter))); }
  async countDocuments(filter = {}) { return this.docs.filter((doc) => matches(doc, filter)).length; }
  async updateOne(filter, update, options = {}) {
    const now = new Date();
    let doc = this.docs.find((item) => matches(item, filter));
    let inserting = false;
    if (!doc) {
      if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      inserting = true;
      doc = { _id: new ObjectId() };
      for (const [key, value] of Object.entries(filter)) if (!key.includes('.') && !isPlainObject(value)) doc[key] = clone(value);
    }
    const draft = clone(doc);
    applyUpdate(draft, update, { filter, inserting, now });
    this.assertUnique(draft, inserting ? undefined : doc);
    if (inserting) this.docs.push(draft); else Object.assign(doc, draft);
    return { matchedCount: inserting ? 0 : 1, modifiedCount: inserting ? 0 : 1, upsertedCount: inserting ? 1 : 0 };
  }
  async findOneAndUpdate(filter, update, options = {}) {
    const doc = this.docs.find((item) => matches(item, filter));
    if (!doc) return null;
    const before = clone(doc);
    const draft = clone(doc);
    applyUpdate(draft, update, { filter, inserting: false, now: new Date() });
    Object.assign(doc, draft);
    return options.returnDocument === 'after' ? clone(doc) : before;
  }
  async deleteOne(filter) {
    const index = this.docs.findIndex((doc) => matches(doc, filter));
    if (index === -1) return { deletedCount: 0 };
    this.docs.splice(index, 1);
    return { deletedCount: 1 };
  }
}

export function createFakeDb() {
  const collections = new Map();
  return {
    databaseName: 'skillbridge_test',
    collection(name) {
      if (!collections.has(name)) collections.set(name, new FakeCollection(name));
      return collections.get(name);
    },
    async command() { return { ok: 1 }; },
  };
}
