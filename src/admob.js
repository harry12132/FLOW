import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const APP_REWARDED_ID = 'ca-app-pub-6502482353883584/3099512373';
const GOOGLE_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

let initialization = null;
let ready = false;
let rewardedAdPrepared = false;

const rewardedAdOptions = () => ({
  adId: import.meta.env.DEV ? GOOGLE_TEST_REWARDED_ID : APP_REWARDED_ID,
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
      return true;
    } catch {
      // Ads are optional. Consent, network, or SDK errors must never block FLOW.
      return false;
    } finally {
      initialization = null;
    }
  })();
  return initialization;
}

// Returns true only when the SDK reports a completed reward. A dismissed or
// unavailable ad never grants a bonus hint.
export async function showRewardedHintAd() {
  if (!Capacitor.isNativePlatform()) return false;
  if (!ready && !(await initializeAdMob())) return false;

  try {
    await AdMob.prepareRewardVideoAd(rewardedAdOptions());
    rewardedAdPrepared = true;
    const reward = await AdMob.showRewardVideoAd({ adId: rewardedAdOptions().adId });
    rewardedAdPrepared = false;
    return Boolean(reward && Number(reward.amount) > 0);
  } catch {
    rewardedAdPrepared = false;
    return false;
  }
}
