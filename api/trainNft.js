import { cookie } from "../config.js";

export const trainNft = async (nftId) => {
  const res = await fetch(
    "https://www.api.thekoroshi.com/api/trpc/startNftTraining",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ nftId }),
    }
  );

  const json = await res.json();
  const endAt = json?.[0]?.result?.data?.endAt;
  return endAt ? new Date(endAt).getTime() + 1000 : null;
};
