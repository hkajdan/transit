import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const insertStation = internalMutation({
  args: {
    station: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("stations", args.station);
  },
});

export const fetchSNCFStations = action({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(
      `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/liste-des-gares/records?limit=${args.limit}`,
    );
    const data = await response.json();

    // Insert data into the stations table
    const stations = data.results;
    for (const station of stations) {
      await ctx.runMutation(internal.sncf.insertStation, { station });
    }

    return { success: true, data };
  },
});

export const getStations = query({
  args: {},
  handler: async (ctx, args) => {
    const stations = await ctx.db.query("stations").take(250);

    const stationsGeoJSON = stations
      ? {
          type: "FeatureCollection" as const,
          features: stations.map((station) => station.geo_shape),
        }
      : null;
    console.log(stationsGeoJSON);
    return stationsGeoJSON;
  },
});
