/** @format */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
const sql = neon(
  "postgresql://wastemanagement_owner:KepE7PXwmr3d@ep-sparkling-mouse-a1d66vty.ap-southeast-1.aws.neon.tech/wastemanagement?sslmode=require"
);
export const db = drizzle(sql, { schema });
