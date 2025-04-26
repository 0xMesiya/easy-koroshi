import dotenv from "dotenv";
dotenv.config();

export const cookie = `connect.sid=${process.env.CONNECT_SID};`;
