import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const fetchSNCFStations = action({
  args: {
    limit: v.number(),
  },
  handler: async (_, args) => {
    const response = await fetch(
      `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/liste-des-gares/records?limit=${args.limit}`,
    );
    const data = await response.json();
    return { success: true, data };
  },
});
