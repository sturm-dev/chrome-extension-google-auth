import type { Provider, User } from "@supabase/supabase-js"
import qs from "qs"
import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { supabase } from "~core/supabase"
import { getYoutubeVideoInfo } from "~get-youtube-video-info"

function IndexOptions() {
  const [user, setUser] = useStorage<User>({
    key: "user",
    instance: new Storage({
      area: "local"
    })
  })

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error(error)
        return
      }
      if (!!data.session) {
        setUser(data.session.user)
        sendToBackground({
          name: "init-session",
          body: {
            refresh_token: data.session.refresh_token,
            access_token: data.session.access_token
          }
        })
      }
    }

    init()
  }, [])

  const handleEmailLogin = async (
    type: "LOGIN" | "SIGNUP",
    username: string,
    password: string
  ) => {
    try {
      const {
        error,
        data: { user }
      } =
        type === "LOGIN"
          ? await supabase.auth.signInWithPassword({
              email: username,
              password
            })
          : await supabase.auth.signUp({ email: username, password })

      if (error) {
        alert("Error with auth: " + error.message)
      } else if (!user) {
        alert("Signup successful, confirmation mail should be sent soon!")
      } else {
        setUser(user)
      }
    } catch (error) {
      console.log("error", error)
      alert(error.error_description || error)
    }
  }

  const handleOAuthLogin = async (provider: Provider, scopes = "email") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        scopes,
        redirectTo: location.href
      }
    })
  }

  const testYoutubeApiWithToken = async ({
    auth_token
  }: {
    auth_token: string
  }) => {
    // video id from the same user than the one logged in
    const { data: getYoutubeVideoInfo_data, error: getYoutubeVideoInfo_error } =
      await getYoutubeVideoInfo({ auth_token, video_id: "LSqzQsBL6r8" })
    if (getYoutubeVideoInfo_error) throw { getYoutubeVideoInfo_error }
    // ERROR -> "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project."
    // It's seems that the token from auth/v1 is not valid for the youtube api (need for a OAuth 2 access token)

    console.log(`getYoutubeVideoInfo_data`, getYoutubeVideoInfo_data)
  }

  const handleLoginWithGoogle_auth_v1 = async () => {
    try {
      // NOTE: add this to your supabase auth redirect URLs list (Authentication > URL Configuration > Redirect URLs)
      const redirectUri = chrome.identity.getRedirectURL("supabase-auth")
      const options = { provider: "google", redirect_to: redirectUri }
      const url = `${
        process.env.PLASMO_PUBLIC_SUPABASE_URL
      }/auth/v1/authorize?${qs.stringify(options)}`

      const authorizeResult: string = await new Promise((resolve) => {
        chrome.identity.launchWebAuthFlow(
          { url, interactive: true },
          (callbackUrl) => resolve(callbackUrl)
        )
      })
      if (!authorizeResult) throw { error: "No authorizeResult" }

      const { access_token, refresh_token } = qs.parse(
        authorizeResult?.split("#")[1]
      )

      const setSession_result = await supabase.auth.setSession({
        access_token,
        refresh_token
      })

      const session = setSession_result.data.session
      console.log(`session`, session)
    } catch (error) {
      console.error(`error`, error)
    }
  }

  const handleLoginWithGoogle_oauth_2 = async () => {
    const manifest = chrome.runtime.getManifest()

    const url = new URL("https://accounts.google.com/o/oauth2/auth")
    const redirectUri = chrome.identity.getRedirectURL("supabase-auth")
    console.log(`redirectUri`, redirectUri)
    // -> https://dekkcnhhmkcahchnaphlibnodmigphnc.chromiumapp.org/supabase-auth
    // save on google cloud console > credentials > OAuth 2.0 Client IDs > Web client
    // save on supabase > Authentication > URL Configuration > Redirect URLs
    // scopes on manifest - only ["openid", "email", "profile"]

    url.searchParams.set("client_id", manifest.oauth2.client_id)
    url.searchParams.set("response_type", "id_token")
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("scope", manifest.oauth2.scopes.join(" "))

    console.log(`url`, url)

    console.log(`url.href`, url.href)

    chrome.identity.launchWebAuthFlow(
      {
        url: url.href,
        interactive: true
      },
      async (redirectedTo) => {
        if (chrome.runtime.lastError) {
          // auth was not successful
          console.log(
            "There was an error with the authentication: ",
            chrome.runtime.lastError.message
          )
        } else {
          console.log("auth was successful")
          console.log(`redirectedTo`, redirectedTo)

          // auth was successful, extract the ID token from the redirectedTo URL
          const url = new URL(redirectedTo)
          const params = new URLSearchParams(url.hash.replace("#", ""))
          const token = params.get("id_token")

          console.log(`auth was successful - url`, url)
          console.log(`auth was successful - token`, token)

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token
          })

          console.log(`error`, error)
          console.log(`data`, data)
        }
      }
    )
  }

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        top: 240,
        position: "relative"
      }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 240,
          justifyContent: "space-between",
          gap: 4.2
        }}>
        {user && (
          <>
            <h3>
              {user.email} - {user.id}
            </h3>
            <button
              onClick={() => {
                supabase.auth.signOut()
                setUser(null)
              }}>
              Logout
            </button>
          </>
        )}
        {!user && (
          <>
            <label>Email</label>
            <input
              type="text"
              placeholder="Your Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={(e) => {
                handleEmailLogin("SIGNUP", username, password)
              }}>
              Sign up
            </button>
            <button
              onClick={(e) => {
                handleEmailLogin("LOGIN", username, password)
              }}>
              Login
            </button>

            <button
              onClick={(e) => {
                handleOAuthLogin("github")
              }}>
              Sign in with GitHub
            </button>

            <button
              onClick={(e) => {
                handleLoginWithGoogle_oauth_2()
              }}>
              Sign in with Google
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default IndexOptions
