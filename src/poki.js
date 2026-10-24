// Poki SDK bridge. The SDK script is only added in the Poki build (npm run build:poki);
// everywhere else window.PokiSDK is missing and every call here quietly does nothing.
const sdk = () => window.PokiSDK;
let ready = false;
let playing = false;

export const poki = {
  async init() {
    if (!sdk()) return;
    try {
      await sdk().init();
      ready = true;
    } catch (err) {
      // an ad blocker can stop the SDK: the game must still work without it
      console.warn('Poki SDK did not start', err);
    }
  },

  loadingFinished() {
    if (ready) sdk().gameLoadingFinished();
  },

  // tells Poki when the player is actually playing, so ads never cut into gameplay
  gameplay(on) {
    if (!ready || on === playing) return;
    playing = on;
    if (on) sdk().gameplayStart();
    else sdk().gameplayStop();
  },

  // a short ad break at a natural pause; sound is silenced while it runs
  commercialBreak(audio) {
    if (!ready) return Promise.resolve();
    this.gameplay(false);
    return sdk()
      .commercialBreak(() => audio.ctx && audio.ctx.suspend())
      .catch(() => {})
      .then(() => { if (audio.ctx) audio.ctx.resume(); });
  },
};
