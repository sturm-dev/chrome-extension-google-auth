import qs from "qs"

import { supabase } from "~core/supabase"
import { getYoutubeVideoInfo } from "~get-youtube-video-info"

const EXAMPLE_YOUTUBE_VIDEO_ID = "LSqzQsBL6r8"

// ─────────────────────────────────────────────────────────────────────────────

export const googleLogin = async () => {
  try {
    //
    const { access_token } = await launchWebAuthFlow_and_getAccessToken()
    const { id_token } = await launchWebAuthFlow_and_getTokenId()

    await supabaseLogin_with_idToken({ id_token })
    console.log("supabaseLoginWithTokens ok!")

    await testYoutubeApi_with_accessToken({ access_token })
    console.log("testYoutubeApiWithToken ok!")
    //
  } catch (error) {
    console.error(`error-googleLogin`, error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const launchWebAuthFlow_and_getAccessToken = async () => {
  const manifest = chrome.runtime.getManifest()
  const { url } = generateBaseUrl_and_redirectUri()

  url.searchParams.set("response_type", "token")
  url.searchParams.set("scope", manifest.oauth2.scopes.join(" "))

  const { access_token } = await launchWebAuthFlow_and_returnCallBackParams({
    url
  })

  return { access_token }
}

const launchWebAuthFlow_and_getTokenId = async () => {
  const { url } = generateBaseUrl_and_redirectUri()

  url.searchParams.set("response_type", "id_token")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("scope", "openid email profile") // only & fixed scopes for get id_token

  const { id_token } = await launchWebAuthFlow_and_returnCallBackParams({ url })

  return { id_token }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const testYoutubeApi_with_accessToken = async ({
  access_token
}: {
  access_token: string
}) => {
  // video id from the same user than the one logged in
  const { data: getYoutubeVideoInfo_data, error: getYoutubeVideoInfo_error } =
    await getYoutubeVideoInfo({
      auth_token: access_token,
      video_id: EXAMPLE_YOUTUBE_VIDEO_ID
    })
  if (getYoutubeVideoInfo_error) throw { getYoutubeVideoInfo_error }
  // ERROR -> "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project."
  // It's seems that the token from auth/v1 is not valid for the youtube api (need for a OAuth 2 access token)

  console.log(`getYoutubeVideoInfo_data`, getYoutubeVideoInfo_data)
}

// ─────────────────────────────────────────────────────────────────────────────

const supabaseLogin_with_idToken = async ({
  id_token
}: {
  id_token: string
}) => {
  const { data: signInWithIdToken_data, error: signInWithIdToken_error } =
    await supabase.auth.signInWithIdToken({
      provider: "google",
      token: id_token
    })

  if (signInWithIdToken_error)
    throw { supabase_signInWithIdToken_error: signInWithIdToken_error }
  console.log(`signInWithIdToken_data`, signInWithIdToken_data)
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const generateBaseUrl_and_redirectUri = () => {
  const manifest = chrome.runtime.getManifest()

  // https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#redirecting
  const url = new URL("https://accounts.google.com/o/oauth2/auth")

  // NOTE:
  // save EXACT redirectUri on google cloud console > credentials > OAuth 2.0 Client IDs > Web client
  // save EXACT redirectUri on supabase > Authentication > URL Configuration > Redirect URLs
  const redirectUri = chrome.identity.getRedirectURL("supabase-auth")
  // console.log(`redirectUri`, redirectUri) // -> https://dekkcnhhmkcahbhnaphlibnodmigphnc.chromiumapp.org/supabase-auth

  url.searchParams.set("client_id", manifest.oauth2.client_id)
  url.searchParams.set("redirect_uri", redirectUri)

  return { url }
}

// ─────────────────────────────────────────────────────────────────────────────

const launchWebAuthFlow_and_returnCallBackParams = async ({ url }) => {
  const authorizeResult: string = await new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: url.href, interactive: true },
      (callbackUrl) => resolve(callbackUrl)
    )
  })
  if (!authorizeResult) throw { error: "No authorizeResult" }

  return qs.parse(authorizeResult?.split("#")[1])
}

// ─────────────────────────────────────────────────────────────────────────────
