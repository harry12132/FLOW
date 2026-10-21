import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const APP_INTERSTITIAL_ID = 'ca-app-pub-6502482353883584/1198796864';
const GOOGLE_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

let initialization = null;
let ready = false;
let adPrepared = false;

const adOptions = () => ({
  adId: import.meta.env.DEV ? GOOGLE_TEST_INTERSTITIAL_ID : APP_INTERSTITIAL_ID,
  isTesting: Boolean(import.meta.env.DEV),
  npa: true,
  immersiveMode: true,
});

export async function initializeAdMob() {
  if (!Capacitor.isNativePlatform()) return false;
  if (ready) return true;
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }
      if (!consent.canRequestAds) return false;
      await AdMob.initialize();
      ready = true;
      await prepareNextInterstitial();
      return true;
    } catch {
      // Ads are optional. A consent, network, or SDK error must never block FLOW.
      return false;
    } finally {
      initialization = null;
    }
  })();
  return initialization;
}

async function prepareNextInterstitial() {
  if (!ready || adPrepared) return false;
  try {
    await AdMob.prepareInterstitial(adOptions());
    adPrepared = true;
    return true;
  } catch {
    adPrepared = false;
    return false;
  }
}

// Interstitials are shown only at a natural level transition, never mid-puzzle.
export async function showInterstitialAtLevelBreak() {
  if (!Capacitor.isNativePlatform()) return false;
  if (!ready && !(await initializeAdMob())) return false;
  if (!adPrepared && !(await prepareNextInterstitial())) return false;
  try {
    await AdMob.showInterstitial({ adId: adOptions().adId });
    adPrepared = false;
    void prepareNextInterstitial();
    return true;
  } catch {
    adPrepared = false;
    void prepareNextInterstitial();
    return false;
  }
}
