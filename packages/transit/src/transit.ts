/** Transit domain types shared between backend and frontend */

export const Country = {
  FR: "FR",
  DE: "DE",
  CH: "CH",
  BE: "BE",
  NL: "NL",
  IT: "IT",
  ES: "ES",
} as const;

export type Country = (typeof Country)[keyof typeof Country];

export const Network = {
  SNCF: "SNCF",
  DB: "DB",
  SBB: "SBB",
  SNCB: "SNCB",
  NS: "NS",
  TRENITALIA: "TRENITALIA",
  RENFE: "RENFE",
} as const;

export type Network = (typeof Network)[keyof typeof Network];
