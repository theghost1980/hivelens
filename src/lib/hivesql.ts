
'use server';

/**
 * @fileOverview HiveSQL database connection and query utilities.
 *
 * - executeQuery - Executes a given SQL query against the HiveSQL database.
 * - testConnection - Tests the connection to HiveSQL with a simple query.
 */

import dotenv from "dotenv";
import sql from "mssql";
import { TimeUtils } from "./time.utils";

// Ensure .env variables are loaded if not already by Next.js
// Next.js automatically loads .env.local, .env.development, .env.production, .env
// For server-side code, direct access to process.env should work.
// Explicitly calling dotenv.config() here can be a fallback.
// We check for one variable; if it's missing, we attempt to load .env
if (!process.env.HIVE_HOST) {
  dotenv.config({ path: '.env' }); 
}

// Validate essential environment variables
const requiredEnvVars = [
  'HIVE_USER',
  'HIVE_PASSWORD',
  'HIVE_DATABASE',
  'HIVE_HOST',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  const errorMessage = `Missing required HiveSQL environment variables: ${missingEnvVars.join(', ')}. Please ensure they are set in your .env file.`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

const sqlConfig: sql.config = {
  user: process.env.HIVE_USER!,
  password: process.env.HIVE_PASSWORD!,
  database: process.env.HIVE_DATABASE!,
  server: process.env.HIVE_HOST!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    trustServerCertificate: true, // Recommended to set to false for production with valid certs
    encrypt: true, // For Azure SQL or if your SQL Server requires encryption
  },
  requestTimeout: 120000, // 2 minutes
};

/**
 * Executes a SQL query and returns the results along with execution time.
 * @param query The SQL query string to execute.
 * @returns A promise that resolves to an object containing results and execution time.
 * @template T The expected type of the items in the results array.
 */
export async function executeQuery<T = any>(query: string): Promise<{
  results: T[];
  time: number;
}> {
  try {
    const pool = await sql.connect(sqlConfig);
    const start = TimeUtils.start();
    const result = await pool.request().query<T>(query);
    const timeExecutionQuery = TimeUtils.calculate(start);
    console.log(`Executed query in ${timeExecutionQuery.toFixed(2)} ms. Rows: ${result.recordset.length}`);
    return { results: result.recordset, time: timeExecutionQuery };
  } catch (error) {
    console.error("Error executing HiveSQL query:", error instanceof Error ? error.message : error);
    if (error instanceof sql.RequestError) {
      console.error("SQL RequestError Details:", {
        code: error.code,
        lineNumber: error.lineNumber,
        state: error.state,
        class: error.class,
        serverName: error.serverName,
        procName: error.procName,
      });
    }
    throw new Error(`Failed to execute HiveSQL query. ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Tests the connection to the HiveSQL database by fetching the top 1 account.
 * @returns A promise that resolves to an object with results and execution time, or null on error.
 */
export const testConnection = async (): Promise<{
  results: any[];
  time_ms: number;
} | null> => {
  try {
    // The executeQuery function already handles connection and timing.
    const simpleQuery = "SELECT TOP 1 name, created FROM Accounts;";
    const { results, time } = await executeQuery(simpleQuery);
    return { time_ms: time, results: results };
  } catch (err) {
    // executeQuery already logs the error.
    return null;
  }
};
