import type { Provider, User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { supabase } from "~core/supabase"

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

  const handleLoginWithGoogle = async () => {
    const manifest = chrome.runtime.getManifest()

    const url = new URL("https://accounts.google.com/o/oauth2/auth")

    url.searchParams.set("client_id", manifest.oauth2.client_id)
    url.searchParams.set("response_type", "id_token")
    url.searchParams.set("access_type", "offline")
    url.searchParams.set(
      "redirect_uri",
      `https://${chrome.runtime.id}.chromiumapp.org`
    )
    url.searchParams.set("scope", manifest.oauth2.scopes.join(" "))

    console.log(`url`, url)

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
          // auth was successful, extract the ID token from the redirectedTo URL
          const url = new URL(redirectedTo)
          const params = new URLSearchParams(url.hash)

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: params.get("id_token")
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
                handleLoginWithGoogle()
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
