export default {
  dialect: "postgresql",
  schema: "./src/utils/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "postgresql://wastemanagement_owner:KepE7PXwmr3d@ep-sparkling-mouse-a1d66vty.ap-southeast-1.aws.neon.tech/wastemanagement?sslmode=require",
    connectionString:
      "postgresql://wastemanagement_owner:KepE7PXwmr3d@ep-sparkling-mouse-a1d66vty.ap-southeast-1.aws.neon.tech/wastemanagement?sslmode=require",
  },
};
