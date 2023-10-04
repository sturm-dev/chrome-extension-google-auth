// NOTE: prerequisites -> https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps#prerequisites
// - generate API key
// - enable YouTube Data API v3
// - add scope to manifest.oauth2.scopes "https://www.googleapis.com/auth/youtube.readonly" to later chrome.identity can check the scopes needed
// - add scope-permission to consent screen

export const getYoutubeVideoInfo = async ({
  auth_token,
  video_id
}: {
  auth_token: string
  video_id: string
}): Promise<{ data?: any; error?: any }> => {
  try {
    const API_KEY = process.env.PLASMO_PUBLIC_GOOGLE_CLOUD_API_KEY
    const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails%2Cstatistics&id=${video_id}&key=${API_KEY}`

    const init = {
      method: "GET",
      async: true,
      headers: {
        Authorization: "Bearer " + auth_token,
        "Content-Type": "application/json"
      },
      contentType: "json"
    }

    const response = await fetch(url, init)
    const data = await response.json()

    return { data }
  } catch (error) {
    console.log(`error-getVideoInfo`, error)
    return { error }
  }
}
