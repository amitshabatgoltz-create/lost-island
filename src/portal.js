// Game portal bridge (Poki or CrazyGames). Each portal's SDK script is only added in its own build
// (npm run build:poki / build:crazygames); everywhere else no SDK is present and every call here
// quietly does nothing.
let sdk = null; // { loadingFinished, gameplayStart, gameplayStop, ad(onStart) -> Promise }
let playing = false;

function pokiAdapter(P) {
  return {
    async init() { await P.init(); },
    loadingFinished: () => P.gameLoadingFinished(),
    gameplayStart: () => P.gameplayStart(),
    gameplayStop: () => P.gameplayStop(),
    ad: (onStart) => P.commercialBreak(onStart),
  };
}

function crazyAdapter(C) {
  return {
    async init() { await C.init(); C.game.loadingStart(); },
    loadingFinished: () => C.game.loadingStop(),
    gameplayStart: () => C.game.gameplayStart(),
    gameplayStop: () => C.game.gameplayStop(),
    ad: (onStart) => new Promise((resolve) => {
      C.ad.requestAd('midgame', { adStarted: onStart, adFinished: resolve, adError: resolve });
    }),
  };
}

export const portal = {
  async init() {
    const a = window.PokiSDK ? pokiAdapter(window.PokiSDK)
      : window.CrazyGames && window.CrazyGames.SDK ? crazyAdapter(window.CrazyGames.SDK) : null;
    if (!a) return;
    try {
      await a.init();
      sdk = a;
    } catch (err) {
      // an ad blocker can stop the SDK: the game must still work without it
      console.warn('Portal SDK did not start', err);
    }
  },

  loadingFinished() {
    if (sdk) sdk.loadingFinished();
  },

  // tells the portal when the player is actually playing, so ads never cut into gameplay
  gameplay(on) {
    if (!sdk || on === playing) return;
    playing = on;
    if (on) sdk.gameplayStart();
    else sdk.gameplayStop();
  },

  // a short ad break at a natural pause; sound is silenced while it runs
  commercialBreak(audio) {
    if (!sdk) return Promise.resolve();
    this.gameplay(false);
    return Promise.resolve(sdk.ad(() => audio.ctx && audio.ctx.suspend()))
      .catch(() => {})
      .then(() => { if (audio.ctx) audio.ctx.resume(); });
  },
};
