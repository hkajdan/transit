import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addRow = mutation({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("This is running on the server");
    await ctx.db.insert("tests", {
      content: args.content,
    });
  },
});

export const test = query({
  args: {},
  handler: () => {
    return "OK";
  },
});
