import dotenv from "dotenv";
dotenv.config();

export const cookie = `__cf_bm=${process.env.CF_BM}; Path=/; Domain=www.api.thekoroshi.com; Secure; HttpOnly; connect.sid=${process.env.CONNECT_SID}; Path=/; HttpOnly;`;
