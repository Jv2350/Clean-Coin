/** @format */

import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

// Initialize the Neon PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Use your Neon connection string from the .env.local file
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { name, email, phone, address, notifications } = req.body;

    try {
      // Update the user settings in the database
      const query = `
        UPDATE users 
        SET name = $1, email = $2, phone = $3, address = $4, notifications = $5 
        WHERE user_id = $6
      `;
      const values = [name, email, phone, address, notifications, 1]; // Replace '1' with the actual user ID

      await pool.query(query, values);

      res.status(200).json({ message: "Settings updated successfully!" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
