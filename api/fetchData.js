import { cookie } from "../config.js";

const baseHeaders = {
  "Content-Type": "application/json",
  Cookie: cookie,
};

export const apiGet = async (url) => {
  const res = await fetch(url, { headers: baseHeaders });
  const json = await res.json();
  if (!res.ok) {
    console.error("API Error:", json);
    throw new Error(`API Error: ${json.message}`);
  }
  return json.result.data;
};

export const getAllNfts = () =>
  apiGet("https://www.api.thekoroshi.com/api/trpc/getMyNfts");
export const getTribes = () =>
  apiGet("https://www.api.thekoroshi.com/api/trpc/getTribes");
export const getTemples = () =>
  apiGet("https://www.api.thekoroshi.com/api/trpc/getTemples");
export const getInfo = () =>
  apiGet("https://www.api.thekoroshi.com/api/trpc/getInfos");
export const apiGetWrapper = apiGet;
