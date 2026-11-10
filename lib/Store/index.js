"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeCacheManagerAuthState = exports.makeInMemoryStore = void 0;
const make_cache_manager_store_1 = __importDefault(require("./make-cache-manager-store"));
exports.makeCacheManagerAuthState = make_cache_manager_store_1.default;
const make_in_memory_store_1 = __importDefault(require("./make-in-memory-store"));
exports.makeInMemoryStore = make_in_memory_store_1.default;

// Database auth states
const database_auth_state_1 = require("./database-auth-state");
exports.useSQLiteAuthState = database_auth_state_1.useSQLiteAuthState;
exports.useMongoDBAuthState = database_auth_state_1.useMongoDBAuthState;
exports.useRedisAuthState = database_auth_state_1.useRedisAuthState;
exports.useMySQLAuthState = database_auth_state_1.useMySQLAuthState;
exports.usePostgresAuthState = database_auth_state_1.usePostgresAuthState;
exports.useNekoDBAuthState = database_auth_state_1.useNekoDBAuthState;
