import { default as stravaImport, Strava } from 'npm:strava-v3@2.2.0'
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { serve } from "https://deno.land/std@0.92.0/http/server.ts";
import { Config } from "./types.ts";


const AUTH_TOKEN = Deno.env.get("AUTH_TOKEN")
const CLIENT_ID = Deno.env.get("CLIENT_ID")
const REDIRECT_URI = Deno.env.get("REDIRECT_URI")
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET")

const strava = stravaImport as unknown as Strava

export function createConfig() {
  if (!AUTH_TOKEN) {
    throw new Error("No AUTH_TOKEN provided")
  } if (!CLIENT_ID) {
    throw new Error("No CLIENT_ID provided")
  } if (!CLIENT_SECRET) {
    throw new Error("No CLIENT_SECRET provided")
  } if (!REDIRECT_URI) {
    throw new Error("No REDIRECT_URI provided")
  }
  
  return {
    "access_token"  : AUTH_TOKEN,
    "client_id"     : CLIENT_ID,
    "client_secret" : CLIENT_SECRET,
    "redirect_uri"  : REDIRECT_URI,
  };
}

export async function getAccessUrl(config: Config):Promise<string> {
  try{
    const accessURL = await strava.oauth.getRequestAccessURL(config)
    console.log(accessURL)
    return accessURL
    

    // const accessUrlResponse = await fetch(accessURL, {
    //   method:"GET",
    //   headers:new Headers(config),
    //   redirect: 'follow'
    // })
    // console.log(accessUrlResponse.url)
    
    // console.log(newURL.searchParams.get("code"))

    // const code = "f3eb8ededc68db4da09e5b0cd782549576929876"

    // const accessToken = await strava.oauth.getToken(code)
    // console.log(accessToken)
    // console.log(await strava.athlete.get({"access_token":accessToken}))
  
  }catch(error){
    throw new Error(error)
  }
}

// Learn more at https://deno.land/manual/examples/module_metadata#concepts
if (import.meta.main) {

  const config = createConfig()
  strava.config(config)

  const server = serve({ port: 8000 });  
  let accessToken

  for await (const req of server) {

    const reqUrl = new URL(REDIRECT_URI + req.url)
    const reqSearchParams = reqUrl.searchParams
    if (reqSearchParams.has("code")){
      console.log("EXISTS")
      accessToken = reqSearchParams.get("code")
    }

    if (!accessToken) {
      const accessUrl = await getAccessUrl(config)
      req.respond({
        status: 302,
        headers: new Headers({
          "Location": accessUrl,
        }),
      });
    } else {
      req.respond({
        status:200,
        body: accessToken
      })
    }

  }
  //   try {
  //     const url = new URL(`http://localhost:8000${req.url}`);
  //     await login()
  //     const authorizationCode = url.searchParams.get("code");
  
  //     if (authorizationCode) {
  //       console.log("Authorization code:", authorizationCode);
  //       // Process the authorization code
  //       req.respond({ body: "Authorization code received" });
  //     } else {
  //       req.respond({ status: 400, body: "Authorization code not found" });
  //     }
  //   } catch (error) {
  //     console.error("Error:", error);
  //     req.respond({ status: 500, body: "Internal Server Error" });
  //   }
  // }

}
