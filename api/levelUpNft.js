import { cookie } from "../config.js";

export const levelUpNft = async (nftId) => {
  const res = await fetch("https://www.api.thekoroshi.com/api/trpc/levelUp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ nftId }),
  });

  const json = await res.json();
  const endAt = json?.result?.data?.endAt;
  return endAt ? new Date(endAt).getTime() + 1000 : null;
};
