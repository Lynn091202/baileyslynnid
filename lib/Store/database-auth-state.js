"use strict";
/**
 * @lynnidoffc/baileys — Database Auth State
 * Simpan sesi di SQLite, MongoDB, Redis, MySQL, PostgreSQL, atau NekoDB
 * 
 * Usage:
 *   const { useSQLiteAuthState }   = require('baileys')
 *   const { useMongoDB AuthState } = require('baileys')
 *   const { useRedisAuthState }    = require('baileys')
 *   const { useMySQLAuthState }    = require('baileys')
 *   const { usePostgresAuthState } = require('baileys')
 */

const { proto } = require('../../WAProto');
const { initAuthCreds, BufferJSON } = require('../Utils');
const { BufferJSON: BJ } = require('../Utils/generics');

// ─── Helper ──────────────────────────────────────────────────────────────────

function serialize(val) {
    return JSON.stringify(val, BJ.replacer || BufferJSON.replacer);
}

function deserialize(str) {
    if (!str) return null;
    return JSON.parse(str, BJ.reviver || BufferJSON.reviver);
}

// ─── SQLite ──────────────────────────────────────────────────────────────────

/**
 * SQLite auth state — simpan sesi di file SQLite lokal
 * 
 * @param {string} path   Path file SQLite (default: './session.db')
 * 
 * @example
 * const { useSQLiteAuthState } = require('baileys')
 * const { state, saveCreds } = await useSQLiteAuthState('./my-session.db')
 * const sock = makeWASocket({ auth: state })
 * sock.ev.on('creds.update', saveCreds)
 */
async function useSQLiteAuthState(path = './session.db') {
    let db;
    try {
        const Database = require('better-sqlite3');
        db = new Database(path);
        db.exec(`CREATE TABLE IF NOT EXISTS auth (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    } catch (e) {
        throw new Error(
            `[useSQLiteAuthState] better-sqlite3 tidak terinstall.\n` +
            `Jalankan: npm install better-sqlite3\n` +
            `Error: ${e.message}`
        );
    }

    const get = (key) => {
        const row = db.prepare('SELECT value FROM auth WHERE key = ?').get(key);
        return row ? deserialize(row.value) : null;
    };
    const set = (key, val) => {
        if (val == null) {
            db.prepare('DELETE FROM auth WHERE key = ?').run(key);
        } else {
            db.prepare('INSERT OR REPLACE INTO auth (key, value) VALUES (?, ?)').run(key, serialize(val));
        }
    };

    const creds = get('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const val = get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }
                    return data;
                },
                set: (data) => {
                    for (const [type, typeData] of Object.entries(data)) {
                        for (const [id, val] of Object.entries(typeData)) {
                            set(`${type}-${id}`, val);
                        }
                    }
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

// ─── MongoDB ─────────────────────────────────────────────────────────────────

/**
 * MongoDB auth state
 * 
 * @param {string|object} connection   MongoDB URI string atau instance MongoClient
 * @param {string}        dbName       Nama database (default: 'baileys_session')
 * @param {string}        collection   Nama collection (default: 'auth')
 * 
 * @example
 * const { useMongoDBAuthState } = require('baileys')
 * const { state, saveCreds } = await useMongoDBAuthState(
 *   'mongodb://localhost:27017',
 *   'baileys_session'
 * )
 */
async function useMongoDBAuthState(connection, dbName = 'baileys_session', collectionName = 'auth') {
    let col;
    try {
        const { MongoClient } = require('mongodb');
        const client = typeof connection === 'string'
            ? new MongoClient(connection)
            : connection;
        if (!client.topology?.isConnected?.()) await client.connect();
        col = client.db(dbName).collection(collectionName);
        await col.createIndex({ key: 1 }, { unique: true });
    } catch (e) {
        throw new Error(
            `[useMongoDBAuthState] mongodb tidak terinstall atau gagal connect.\n` +
            `Jalankan: npm install mongodb\n` +
            `Error: ${e.message}`
        );
    }

    const get = async (key) => {
        const doc = await col.findOne({ key });
        return doc ? deserialize(doc.value) : null;
    };
    const set = async (key, val) => {
        if (val == null) {
            await col.deleteOne({ key });
        } else {
            await col.updateOne({ key }, { $set: { value: serialize(val) } }, { upsert: true });
        }
    };

    const creds = (await get('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const val = await get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }));
                    return data;
                },
                set: async (data) => {
                    await Promise.all(
                        Object.entries(data).flatMap(([type, typeData]) =>
                            Object.entries(typeData).map(([id, val]) => set(`${type}-${id}`, val))
                        )
                    );
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

// ─── Redis ───────────────────────────────────────────────────────────────────

/**
 * Redis auth state
 * 
 * @param {object} client    Redis client (ioredis atau redis npm)
 * @param {string} prefix    Prefix key (default: 'baileys:')
 * 
 * @example
 * const Redis = require('ioredis')
 * const redis = new Redis()
 * const { useRedisAuthState } = require('baileys')
 * const { state, saveCreds } = await useRedisAuthState(redis)
 */
async function useRedisAuthState(client, prefix = 'baileys:') {
    if (!client) {
        throw new Error(
            `[useRedisAuthState] Butuh Redis client.\n` +
            `Contoh: const Redis = require('ioredis'); const client = new Redis();\n` +
            `Kemudian: useRedisAuthState(client)`
        );
    }

    const get = async (key) => {
        const val = await client.get(prefix + key);
        return val ? deserialize(val) : null;
    };
    const set = async (key, val) => {
        if (val == null) {
            await client.del(prefix + key);
        } else {
            await client.set(prefix + key, serialize(val));
        }
    };

    const creds = (await get('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const val = await get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }));
                    return data;
                },
                set: async (data) => {
                    await Promise.all(
                        Object.entries(data).flatMap(([type, typeData]) =>
                            Object.entries(typeData).map(([id, val]) => set(`${type}-${id}`, val))
                        )
                    );
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

// ─── MySQL ───────────────────────────────────────────────────────────────────

/**
 * MySQL auth state
 * 
 * @param {object} connection  mysql2 connection/pool
 * @param {string} table       Nama tabel (default: 'baileys_auth')
 * 
 * @example
 * const mysql = require('mysql2/promise')
 * const pool = mysql.createPool({ host: 'localhost', user: 'root', database: 'bot' })
 * const { useMySQLAuthState } = require('baileys')
 * const { state, saveCreds } = await useMySQLAuthState(pool)
 */
async function useMySQLAuthState(connection, table = 'baileys_auth') {
    if (!connection) {
        throw new Error(
            `[useMySQLAuthState] Butuh mysql2 connection.\n` +
            `Jalankan: npm install mysql2`
        );
    }

    const exec = async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
    };

    await exec(`CREATE TABLE IF NOT EXISTS \`${table}\` (
        \`key\` VARCHAR(500) PRIMARY KEY,
        \`value\` LONGTEXT NOT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    const get = async (key) => {
        const rows = await exec(`SELECT value FROM \`${table}\` WHERE \`key\` = ?`, [key]);
        return rows.length ? deserialize(rows[0].value) : null;
    };
    const set = async (key, val) => {
        if (val == null) {
            await exec(`DELETE FROM \`${table}\` WHERE \`key\` = ?`, [key]);
        } else {
            await exec(
                `INSERT INTO \`${table}\` (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = ?`,
                [key, serialize(val), serialize(val)]
            );
        }
    };

    const creds = (await get('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const val = await get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }));
                    return data;
                },
                set: async (data) => {
                    await Promise.all(
                        Object.entries(data).flatMap(([type, typeData]) =>
                            Object.entries(typeData).map(([id, val]) => set(`${type}-${id}`, val))
                        )
                    );
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

/**
 * PostgreSQL auth state
 * 
 * @param {object} pool    pg Pool
 * @param {string} table   Nama tabel (default: 'baileys_auth')
 * 
 * @example
 * const { Pool } = require('pg')
 * const pool = new Pool({ connectionString: 'postgresql://user:pass@localhost/db' })
 * const { usePostgresAuthState } = require('baileys')
 * const { state, saveCreds } = await usePostgresAuthState(pool)
 */
async function usePostgresAuthState(pool, table = 'baileys_auth') {
    if (!pool) {
        throw new Error(
            `[usePostgresAuthState] Butuh pg Pool.\n` +
            `Jalankan: npm install pg`
        );
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    const get = async (key) => {
        const { rows } = await pool.query(`SELECT value FROM ${table} WHERE key = $1`, [key]);
        return rows.length ? deserialize(rows[0].value) : null;
    };
    const set = async (key, val) => {
        if (val == null) {
            await pool.query(`DELETE FROM ${table} WHERE key = $1`, [key]);
        } else {
            await pool.query(
                `INSERT INTO ${table} (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, serialize(val)]
            );
        }
    };

    const creds = (await get('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const val = await get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }));
                    return data;
                },
                set: async (data) => {
                    await Promise.all(
                        Object.entries(data).flatMap(([type, typeData]) =>
                            Object.entries(typeData).map(([id, val]) => set(`${type}-${id}`, val))
                        )
                    );
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

// ─── NekoDB (simple JSON-based DB, no external dep) ──────────────────────────

/**
 * NekoDB auth state — simple file-based JSON DB (tidak perlu package eksternal)
 * Cocok untuk hosting yang tidak support sqlite
 * 
 * @param {string} filePath  Path file JSON (default: './neko-session.json')
 * 
 * @example
 * const { useNekoDBAuthState } = require('baileys')
 * const { state, saveCreds } = await useNekoDBAuthState('./session.json')
 */
async function useNekoDBAuthState(filePath = './neko-session.json') {
    const fs = require('fs');
    const path = require('path');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let store = {};
    if (fs.existsSync(filePath)) {
        try {
            store = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (_) {
            store = {};
        }
    }

    const save = () => {
        fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
    };

    const get = (key) => {
        const val = store[key];
        return val ? deserialize(val) : null;
    };
    const set = (key, val) => {
        if (val == null) {
            delete store[key];
        } else {
            store[key] = serialize(val);
        }
        save();
    };

    const creds = get('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const val = get(`${type}-${id}`);
                        if (val) data[id] = type === 'app-state-sync-key'
                            ? proto.Message.AppStateSyncKeyData.fromObject(val)
                            : val;
                    }
                    return data;
                },
                set: (data) => {
                    for (const [type, typeData] of Object.entries(data)) {
                        for (const [id, val] of Object.entries(typeData)) {
                            set(`${type}-${id}`, val);
                        }
                    }
                }
            }
        },
        saveCreds: () => set('creds', creds)
    };
}

exports.useSQLiteAuthState = useSQLiteAuthState;
exports.useMongoDBAuthState = useMongoDBAuthState;
exports.useRedisAuthState = useRedisAuthState;
exports.useMySQLAuthState = useMySQLAuthState;
exports.usePostgresAuthState = usePostgresAuthState;
exports.useNekoDBAuthState = useNekoDBAuthState;
