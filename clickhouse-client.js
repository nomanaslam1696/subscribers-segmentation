import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@clickhouse/client";

export const clickhouse = createClient({
  host: process.env.CH_MIGRATIONS_HOST,
  username: process.env.CH_MIGRATIONS_USER,
  password: process.env.CH_MIGRATIONS_PASSWORD
});
