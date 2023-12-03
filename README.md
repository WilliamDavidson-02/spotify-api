# spotify-api

<img src="https://i.giphy.com/media/lvOnlEYunAwOkHjgmU/giphy.webp" alt="Spotify"/>

This is a small spotify api project that allows you to search for an artist and play there top 4 songs.

The Web api allow a user to make a search for an artist or a track, album ect. The web playback sdk allows the user to play a song directly in the browser.

Local storage saves the recently searched artist making it easier for the user to go back to the previous artists.

### APi's

- Spotify, [`Web api`](https://developer.spotify.com/documentation/web-api)
  - Authentication
  - Search artist
  - Top tracks
- Spotify, [`Web Playback SDK`](https://developer.spotify.com/documentation/web-playback-sdk)
  - Play song on the browser
  - Player controls, previous, pause and next song
  - Volume

### Installation

```bash
git clone https://github.com/WilliamDavidson-02/spotify-api.git
```

Then cd in to the cloned repo and start a live server

### Localhost

If you are running the page on a localhost make sure that the url looks like `http://127.0.0.1:5500/` for the authentication to work when redirecting back from spotify Oauth.
