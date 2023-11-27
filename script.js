const searchForm = document.querySelector("#search-form");
const resultContainer = document.querySelector("#result-container");
const recentSearch = document.querySelector("#recent-search");
const loginBtn = document.querySelector("#login");
const refreshTokenBtn = document.querySelector("#refresh-token");
const volumeRange = document.querySelector("#volume");
const volumeIcon = document.querySelector("#volume-icon");
const currentTrackPlaying = document.querySelector("#current-track-playing");

const controlPrev = document.querySelector("#control-prev");
const controlPlay = document.querySelector("#control-play");
const controlNext = document.querySelector("#control-next");

const clientId = "55dfa3213cc24efab317f71496074c13";
const clientSecret = "36c0e5ddae2548b6a436665aadacd925";
let deviceId = "";
let player;
let currentTrack = null;

const baseUrl = "https://api.spotify.com/v1";
const redirectUri = window.location.href.startsWith("http://127.0.0.1:5500")
  ? "http://127.0.0.1:5500/"
  : "https://williamdavidson-02.github.io/spotify-api/";

function authSpotify() {
  function generateRandomString(length) {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  async function generateCodeChallenge(codeVerifier) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier)
    );

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  function generateUrlWithSearchParams(url, params) {
    const urlObject = new URL(url);
    urlObject.search = new URLSearchParams(params).toString();

    return urlObject.toString();
  }

  function redirectToSpotifyAuthorizeEndpoint() {
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
          redirect_uri: redirectUri,
        }
      );
    });
  }

  function exchangeToken(code) {
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
        redirect_uri: redirectUri,
        code_verifier,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        processTokenResponse(data);

        initPlaybackSdk();

        const url = new URL(window.location.href);

        url.searchParams.delete("code");

        window.location.href = url;
      })
      .catch((error) => console.error(error));
  }

  function processTokenResponse(data) {
    const { access_token, refresh_token, expires_in } = data;

    const time = new Date();
    const expires_at = time.setSeconds(time.getSeconds() + expires_in);

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("expires_at", expires_at);
  }

  function refreshToken() {
    fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: localStorage.getItem("refresh_token"),
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        processTokenResponse(data);
      });
  }

  const args = new URLSearchParams(window.location.search);
  const code = args.get("code");

  if (code) exchangeToken(code);

  loginBtn.addEventListener("click", redirectToSpotifyAuthorizeEndpoint);
  refreshTokenBtn.addEventListener("click", refreshToken);
}

function initPlaybackSdk() {
  // Add cdn only when we have a access_token
  const playbackSdkScript = document.createElement("script");
  playbackSdkScript.src = "https://sdk.scdn.co/spotify-player.js";
  document.body.appendChild(playbackSdkScript);

  window.onSpotifyWebPlaybackSDKReady = () => {
    const token = localStorage.getItem("access_token");
    player = new Spotify.Player({
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

    player.addListener(
      "player_state_changed",
      ({ track_window: { current_track } }) => {
        togglePayingGreen(current_track.id);
        fetch(`${baseUrl}/tracks/${current_track.id}?market=ES`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        })
          .then((response) => response.json())
          .then((data) => createCurrentTrack(data));
      }
    );

    // Error
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
}

function createCurrentTrack(track) {
  currentTrackPlaying.innerHTML = "";

  const trackImg = document.createElement("img");
  trackImg.classList.add("track-cover-img");
  trackImg.src = track.album.images[2].url;

  const trackInfoContainer = document.createElement("div");
  trackInfoContainer.classList.add("current-track-info");

  const trackName = document.createElement("div");
  trackName.classList.add("track-name");
  trackName.textContent = track.name;

  const trackArtistsContainer = document.createElement("div");
  trackArtistsContainer.classList.add("track-artists-container");

  const explicit = document.createElement("div");
  explicit.classList.add("explicit");
  explicit.textContent = "E";
  if (track.explicit) {
    explicit.style.display = "none";
  }

  trackArtistsContainer.appendChild(explicit);

  track.artists.forEach((artist, idx) => {
    const artistName = document.createElement("a");
    artistName.href = artist.external_urls.spotify;
    artistName.textContent =
      track.artists.length > 1 && idx !== track.artists.length - 1
        ? `${artist.name}, `
        : artist.name;
    artistName.classList.add("artist-name-sm");
    artistName.setAttribute("target", "_blank");

    artistName.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });

    trackArtistsContainer.appendChild(artistName);
  });

  trackInfoContainer.append(trackName, trackArtistsContainer);
  currentTrackPlaying.append(trackImg, trackInfoContainer);
}

function createSearchArtistCard(artist) {
  const artistContainer = document.createElement("div");
  artistContainer.classList.add("artist-container", "result-artist-container");

  const artistProfileContainer = document.createElement("div");
  artistProfileContainer.classList.add("artist-profile-container");

  const artistImg = document.createElement("img");
  artistImg.src = artist.image;
  artistImg.classList.add("profile-img");

  const artistName = document.createElement("h3");
  artistName.textContent = artist.name;

  const playBtn = document.createElement("button");
  playBtn.classList.add("play-icon");
  playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

  artistProfileContainer.append(artistImg, artistName);
  artistContainer.append(artistProfileContainer, playBtn);
  resultContainer.appendChild(artistContainer);
}

function togglePayingGreen(trackId) {
  const track = document.getElementById(trackId);
  const prevTrack = document.getElementById(currentTrack);

  if (prevTrack !== null) {
    prevTrack.classList.remove("playing-green");
  }
  track.classList.add("playing-green");
  currentTrack = trackId;
}

function isTokenExpired() {
  const expiresAt = parseInt(localStorage.getItem("expires_at"));
  const currentTime = new Date().getTime();

  return currentTime > expiresAt;
}

function createArtistTopTracks(tracks) {
  const topTracksContainer = document.createElement("div");
  topTracksContainer.classList.add("top-tracks-container");

  let uris = [];

  tracks.forEach((track, index) => {
    uris.push(track.uri);
    const trackName = document.createElement("span");
    trackName.classList.add("track-name");
    if (track.id === currentTrack) {
      trackName.classList.add("playing-green");
    }
    trackName.textContent = track.name;
    trackName.setAttribute("id", track.id); // for targeting the correct track on player state change.

    const trackContainer = document.createElement("div");
    trackContainer.classList.add("track-container");
    trackContainer.addEventListener("click", () => {
      if (isTokenExpired()) return;
      fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          uris,
          offset: { position: index },
          position_ms: 0,
        }),
      }).then(() => {
        togglePayingGreen(track.id);
        controlPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
      });
    });

    const trackNameContainer = document.createElement("div");
    trackNameContainer.classList.add("current-track-info", "top-track-width");

    const trackInfoContainer = document.createElement("div");
    trackInfoContainer.style.display = "flex";

    const albumCover = document.createElement("img");
    albumCover.src = track.album.images[2].url;
    albumCover.style.maxHeight = "43px";
    albumCover.style.marginRight = "16px";

    const trackArtistsContainer = document.createElement("div");
    trackArtistsContainer.classList.add("track-artists-container");

    const explicit = document.createElement("div");
    explicit.classList.add("explicit");
    explicit.textContent = "E";
    if (track.explicit) {
      explicit.style.display = "none";
    }

    trackArtistsContainer.appendChild(explicit);

    track.artists.forEach((artist, idx) => {
      const artistName = document.createElement("a");
      artistName.href = artist.external_urls.spotify;
      artistName.textContent =
        track.artists.length > 1 && idx !== track.artists.length - 1
          ? `${artist.name}, `
          : artist.name;
      artistName.classList.add("artist-name-sm");
      artistName.setAttribute("target", "_blank");

      artistName.addEventListener("click", (ev) => {
        ev.stopPropagation();
      });

      trackArtistsContainer.appendChild(artistName);
    });

    // convert milliseconds to seconds
    let seconds = Math.floor(track.duration_ms / 1000);
    // calc minutes
    let minutes = Math.floor(seconds / 60);
    // assign remaining seconds
    seconds %= 60;

    const trackDuration = document.createElement("div");
    trackDuration.classList.add("track-time");
    trackDuration.textContent = `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;

    trackNameContainer.append(trackName, trackArtistsContainer);
    trackInfoContainer.append(albumCover, trackNameContainer);
    trackContainer.append(trackInfoContainer, trackDuration);
    topTracksContainer.appendChild(trackContainer);
  });
  resultContainer.appendChild(topTracksContainer);
}

async function getArtistTopTracks(id) {
  try {
    const response = await fetch(
      `${baseUrl}/artists/${id}/top-tracks?market=ES`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      }
    );
    const { tracks } = await response.json();

    createArtistTopTracks(tracks.splice(0, 4));
  } catch (error) {
    console.error(error);
  }
}

const searchArtist = async (search) => {
  if (isTokenExpired()) return;

  try {
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    };

    const response = await fetch(
      `${baseUrl}/search?q=${search}&type=artist,album&limit=1`,
      params
    );
    const { artists } = await response.json();

    // Save artist to local storage
    let recentSearch = JSON.parse(localStorage.getItem("recentSearch")) || [];
    const artist = {
      name: artists.items[0].name,
      image: artists.items[0].images[1].url,
    };

    if (recentSearch.length > 0) {
      recentSearch = recentSearch.filter(
        (recent) => recent.name !== artist.name
      );
    }

    localStorage.setItem(
      "recentSearch",
      JSON.stringify([artist, ...recentSearch])
    );

    createRecentlySearched();

    resultContainer.innerHTML = "";

    getArtistTopTracks(artists.items[0].id);
    const { images, name } = artists.items[0];
    createSearchArtistCard({ name, image: images[1].url });
  } catch (error) {
    console.error(error);
  }
};

function createRecentlySearched() {
  const recentlySearched =
    JSON.parse(localStorage.getItem("recentSearch")) || [];
  if (recentlySearched.length === 0) return;
  recentSearch.innerHTML = "";
  const containerTitle = document.createElement("h1");
  containerTitle.textContent = "Recently searched";
  containerTitle.classList.add("section-title");

  const recentCardsContainer = document.createElement("div");
  recentCardsContainer.classList.add("recent-cards-container");

  recentlySearched.forEach((artist) => {
    const card = document.createElement("div");
    card.classList.add(
      "artist-container",
      "artist-profile-container",
      "recent-card"
    );
    card.addEventListener("click", () => {
      searchArtist(artist.name);
    });

    const imgContainer = document.createElement("div");
    imgContainer.classList.add("recent-img-container");

    const x = document.createElement("i");
    x.classList.add("fa-solid", "fa-x", "recent-x");
    x.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const recentStorage = JSON.parse(localStorage.getItem("recentSearch"));

      const removedRecentCard = recentStorage.filter(
        (search) => search.name !== artist.name
      );
      localStorage.setItem("recentSearch", JSON.stringify(removedRecentCard));
      createRecentlySearched();
    });

    const profileImg = document.createElement("img");
    profileImg.classList.add("profile-img");
    profileImg.src = artist.image;

    const artistName = document.createElement("h3");
    artistName.textContent = artist.name;

    imgContainer.append(x, profileImg);
    card.append(imgContainer, artistName);
    recentCardsContainer.appendChild(card);
  });

  recentSearch.append(containerTitle, recentCardsContainer);
}

searchForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const input = searchForm.querySelector("#artist-input");
  searchArtist(input.value);
});

controlPrev.addEventListener("click", () => {
  player.previousTrack();
});

controlPlay.addEventListener("click", () => {
  controlPlay.innerHTML = controlPlay.firstChild.classList.contains("fa-play")
    ? '<i class="fa-solid fa-pause"></i>'
    : '<i class="fa-solid fa-play"></i>';
  player.togglePlay();
});

controlNext.addEventListener("click", () => {
  player.nextTrack();
});

volumeRange.addEventListener("input", () => {
  const volume = parseInt(volumeRange.value);
  if (volume === 0) {
    volumeIcon.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  } else if (volume <= 50) {
    volumeIcon.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
  } else {
    volumeIcon.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  }
  player.setVolume(volume / 100); // playback sdk volume ranges from 0 to 1.
});

// Clear all spotify auth tokens
if (localStorage.getItem("access_token") !== null && isTokenExpired()) {
  const authTokens = [
    "access_token",
    "refresh_token",
    "expires_at",
    "code_verifier",
  ];

  authTokens.forEach((token) => localStorage.removeItem(token));
}

authSpotify();
if (localStorage.getItem("access_token") !== null) initPlaybackSdk();
createRecentlySearched();
