import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/repository/schema/better-auth-tables.ts",
    "./src/repository/schema/custom-tables.ts",
  ],
  out: "./src/repository/migrations",
});
