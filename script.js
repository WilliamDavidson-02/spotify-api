const searchForm = document.querySelector("#search-form");
const resultContainer = document.querySelector("#result-container");
const loginBtn = document.querySelector("#login");

const clientId = "55dfa3213cc24efab317f71496074c13";
const clientSecret = "36c0e5ddae2548b6a436665aadacd925";
let deviceId = "";

const authSpotify = () => {
  const generateRandomString = (length) => {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  const generateCodeChallenge = async (codeVerifier) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier)
    );

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const generateUrlWithSearchParams = (url, params) => {
    const urlObject = new URL(url);
    urlObject.search = new URLSearchParams(params).toString();

    return urlObject.toString();
  };

  const redirectToSpotifyAuthorizeEndpoint = () => {
    const codeVerifier = generateRandomString(64);

    generateCodeChallenge(codeVerifier).then((code_challenge) => {
      window.localStorage.setItem("code_verifier", codeVerifier);

      window.location = generateUrlWithSearchParams(
        "https://accounts.spotify.com/authorize",
        {
          response_type: "code",
          client_id: clientId,
          scope:
            "user-read-private user-read-email streaming user-library-read",
          code_challenge_method: "S256",
          code_challenge,
          redirect_uri: "http://127.0.0.1:5500/",
        }
      );
    });
  };

  const exchangeToken = (code) => {
    console.log(code);
    const code_verifier = localStorage.getItem("code_verifier");

    fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://127.0.0.1:5500/",
        code_verifier,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        processTokenResponse(data);

        // clear search query params in the url
        window.history.replaceState({}, document.title, "/");
      })
      .catch((error) => console.error(error));
  };

  const processTokenResponse = (data) => {
    console.log(data, "process");

    const { access_token, refresh_token, expires_in } = data;

    const t = new Date();
    const expires_at = t.setSeconds(t.getSeconds() + expires_in);

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("expires_at", expires_at);
  };

  const args = new URLSearchParams(window.location.search);
  const code = args.get("code");

  if (code) exchangeToken(code);

  loginBtn.addEventListener("click", redirectToSpotifyAuthorizeEndpoint);
};

const searchArtist = async (search) => {
  const searchUrl = "https://api.spotify.com/v1/search";

  try {
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    };

    const response = await fetch(
      `${searchUrl}?q=${search}&type=artist,album&limit=1`,
      params
    );
    const { artists, albums } = await response.json();
    console.log(albums.items[0].uri);

    const artistContainer = document.createElement("div");
    artistContainer.classList.add("artist-container");

    const artistProfileContainer = document.createElement("div");
    artistProfileContainer.classList.add("artist-profile-container");

    const artistImg = document.createElement("img");
    artistImg.src = artists.items[0].images[1].url;
    artistImg.classList.add("profile-img");

    const artistName = document.createElement("h3");
    artistName.textContent = artists.items[0].name;

    const playBtn = document.createElement("button");
    playBtn.classList.add("play-icon");
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playBtn.addEventListener("click", () => {
      fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          context_uri: albums.items[0].uri,
          position_ms: 0,
        }),
      });
    });

    artistProfileContainer.append(artistImg, artistName);
    artistContainer.append(artistProfileContainer, playBtn);
    resultContainer.appendChild(artistContainer);
  } catch (error) {
    console.error(error);
  }
};

// Playback sdk
window.onSpotifyWebPlaybackSDKReady = () => {
  const token = localStorage.getItem("access_token");
  const player = new Spotify.Player({
    name: "Client baserad utveckling Spotify",
    getOAuthToken: (cb) => {
      cb(token);
    },
    volume: 0.5,
  });

  // Ready
  player.addListener("ready", ({ device_id }) => {
    deviceId = device_id;
    console.log("Ready with Device ID", device_id);
  });

  // Not Ready
  player.addListener("not_ready", ({ device_id }) => {
    console.log("Device ID has gone offline", device_id);
  });

  player.addListener("initialization_error", ({ message }) => {
    console.error(message);
  });

  player.addListener("authentication_error", ({ message }) => {
    console.error(message);
  });

  player.addListener("account_error", ({ message }) => {
    console.error(message);
  });

  player.connect();
};

searchForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const input = searchForm.querySelector("#artist-input");
  searchArtist(input.value);
});

authSpotify();
