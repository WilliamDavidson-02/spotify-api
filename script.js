const searchForm = document.querySelector("#search-form");

const clientId = "55dfa3213cc24efab317f71496074c13";
const clientSecret = "36c0e5ddae2548b6a436665aadacd925";

const fetchToken = async () => {
  const params = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  };
  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    params
  );
  const token = await response.json();

  const currentDate = new Date();
  const expirationDate = new Date(currentDate.getTime() + 1 * 60 * 60 * 1000);

  document.cookie = `bearer=${
    token.access_token
  }; expires=${expirationDate.toUTCString()}; path=/`;
};

const isBearerSet = () => {
  const cookies = document.cookie.split(";");
  let isCookieSet = false;

  cookies.forEach((cookie) => {
    const [cookieName] = cookie.split("=");
    if (cookieName === "bearer") isCookieSet = true;
  });

  return isCookieSet;
};

const getBearer = () => {
  const cookies = document.cookie.split(";");
  let bearer = "";

  cookies.forEach((cookie) => {
    const [cookieName, cookieValue] = cookie.split("=");
    if (cookieName === "bearer") bearer = cookieValue;
  });

  return bearer;
};

const searchArtist = async (search) => {
  const searchUrl = "https://api.spotify.com/v1/search";

  try {
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getBearer()}`,
      },
    };

    const response = await fetch(
      `${searchUrl}?q=${search}&type=artist`,
      params
    );
    const data = await response.json();

    data.artists.items.forEach((artist) => {
      console.log(artist.name);
    });
  } catch (error) {
    console.error(error);
  }
};

searchForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const input = searchForm.querySelector("#artist-input");
  searchArtist(input.value);
});

// Load
if (!isBearerSet()) {
  fetchToken();
}
