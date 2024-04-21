import { Strava } from "npm:strava-v3@2.2.0";
import { Config } from "./types.ts";

export function createConfig(
  ACCESS_TOKEN: string | undefined,
  CLIENT_ID: string | undefined,
  CLIENT_SECRET: string | undefined,
  REDIRECT_URI: string | undefined,
) {
  if (!ACCESS_TOKEN) {
    throw new Error("No AUTH_TOKEN provided");
  }
  if (!CLIENT_ID) {
    throw new Error("No CLIENT_ID provided");
  }
  if (!CLIENT_SECRET) {
    throw new Error("No CLIENT_SECRET provided");
  }
  if (!REDIRECT_URI) {
    throw new Error("No REDIRECT_URI provided");
  }
  return {
    "access_token": ACCESS_TOKEN,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI,
    "approval_prompt": "auto",
    "grant_type": "authorization_code",
  };
}

export async function getAccessUrl(
  strava: Strava,
  config: Config,
): Promise<string> {
  try {
    const accessURL = await strava.oauth.getRequestAccessURL({
      "client_id": config.client_id,
      "redirect_uri": config.redirect_uri,
      "response_type": "code",
      "scope": "activity:read_all,profile:read_all",
    });
    return accessURL;
  } catch (error) {
    throw new Error(error);
  }
}
