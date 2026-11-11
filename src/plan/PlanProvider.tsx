import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import {
  confirmOnDeviceIOS,
  createPurchaseFlow,
  getActiveSubscriptions as readActiveSubscriptions,
  getUserFriendlyErrorMessage,
  isEligibleForIntroOfferIOS,
  isUserCancelledError,
  useIAP,
  type ActiveSubscription,
  type ProductSubscription,
  type Purchase,
  type PurchaseFlow,
  type PurchaseFlowOutcome,
} from 'expo-iap';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { MANAGE_SUBSCRIPTIONS_URL } from '../links';
import { PLUS_PRODUCT_ID } from './limits';

/**
 * Whether this person has Mind to Mouth Plus, and the calls to buy, restore
 * and manage it.
 *
 * The subscription is an App Store auto-renewable subscription, bought and
 * checked with StoreKit on the device (`expo-iap`). There is no server: Apple
 * holds the entitlement, tied to the Apple Account, and the app only ever
 * learns "active or not". That keeps the privacy promise (nothing about
 * purchases reaches the developer) at the price of the weekly counter living
 * on the phone.
 */

export type PurchaseResult =
  | { kind: 'purchased' }
  | { kind: 'cancelled' }
  /** Ask to Buy, or a payment still being confirmed: nothing to show yet. */
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

export type PlanState = {
  /** False until the App Store has answered once (or was given up on). Never goes back to false. */
  ready: boolean;
  isPlus: boolean;
  /** False where the subscription cannot be sold: Android, Expo Go, a build without the store module. */
  canPurchase: boolean;
  /** Localised price from the App Store, e.g. "$4.90". Null until the product has loaded. */
  price: string | null;
  /** "7 days free" when the product has a free trial this Apple Account can still use. */
  trial: string | null;
  /** True while the product is being fetched. */
  loadingProduct: boolean;
  buy: () => Promise<PurchaseResult>;
  /** Re-reads the App Store's purchase history. Resolves to whether Plus is active afterwards. */
  restore: () => Promise<boolean>;
  /** Opens the App Store's subscription settings. */
  manage: () => void;
  /** Tries again to load the price after a failure. */
  reloadProduct: () => void;
};

/**
 * `EXPO_PUBLIC_PLUS_UNLOCKED=1` in `.env` makes a build behave as subscribed.
 * For personal and development builds only (Expo Go, the simulator, a phone
 * build before the product exists in App Store Connect). Never set it for a
 * build that goes to the App Store.
 */
const FORCE_PLUS = (process.env.EXPO_PUBLIC_PLUS_UNLOCKED ?? '').trim() === '1';

/** Last known answer, so a subscriber does not see free-plan limits flash at launch. */
const CACHE_KEY = 'mtm.plan.v1';
/** How long to wait for the App Store before showing the cached answer as final. */
const READY_TIMEOUT_MS = 4000;

const storeAvailable =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoIap') !== null;

const UNAVAILABLE: PlanState = {
  ready: true,
  // Where Plus cannot be bought, nobody is held to the free plan's limits.
  isPlus: true,
  canPurchase: false,
  price: null,
  trial: null,
  loadingProduct: false,
  buy: async () => ({ kind: 'error', message: 'Purchases are not available in this build.' }),
  restore: async () => true,
  manage: () => {},
  reloadProduct: () => {},
};

const PlanContext = createContext<PlanState>(UNAVAILABLE);

export const usePlan = () => useContext(PlanContext);

export function PlanProvider({ children }: { children: ReactNode }) {
  if (!storeAvailable) {
    return <PlanContext.Provider value={UNAVAILABLE}>{children}</PlanContext.Provider>;
  }
  return <StorePlanProvider>{children}</StorePlanProvider>;
}

// One flow for the life of the app. It confirms each purchase against
// StoreKit's own verified transactions and finishes it, and picks up
// purchases that were interrupted (app killed mid-payment, Ask to Buy).
let flow: PurchaseFlow<Purchase> | null = null;
function purchaseFlow(): PurchaseFlow<Purchase> {
  flow ??= createPurchaseFlow({
    confirmWithBackend: confirmOnDeviceIOS(),
    isConsumable: () => false,
  });
  return flow;
}

const hasPlus = (subs: ActiveSubscription[]) =>
  subs.some((s) => s.productId === PLUS_PRODUCT_ID && s.isActive);

function trialLabel(product: ProductSubscription | undefined): string | null {
  if (!product || product.platform !== 'ios') return null;
  if (product.introductoryPricePaymentModeIOS !== 'free-trial') return null;
  const count = Number(product.introductoryPriceNumberOfPeriodsIOS ?? '1') || 1;
  const unit = product.introductoryPriceSubscriptionPeriodIOS;
  if (!unit || unit === 'empty') return null;
  return `${count} ${unit}${count === 1 ? '' : 's'} free`;
}

function StorePlanProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(FORCE_PLUS);
  const [cachedPlus, setCachedPlus] = useState(false);
  const [productFailed, setProductFailed] = useState(false);
  /** True once the store has answered a product request, with or without the product. */
  const [productAsked, setProductAsked] = useState(false);
  /** The subscription group whose free trial this Apple Account can still take. */
  const [trialGroup, setTrialGroup] = useState<string | null>(null);
  /** Settles the promise `buy()` returned once the store reports the outcome. */
  const pendingBuy = useRef<((result: PurchaseResult) => void) | null>(null);

  const settleBuy = useCallback((result: PurchaseResult) => {
    pendingBuy.current?.(result);
    pendingBuy.current = null;
  }, []);

  const onPurchaseFlowOutcome = useCallback(
    ({ status }: PurchaseFlowOutcome<Purchase>) => {
      switch (status.status) {
        case 'entitled':
          settleBuy({ kind: 'purchased' });
          break;
        case 'store_pending':
        case 'verification_delayed':
        case 'verified':
        case 'linked':
          settleBuy({ kind: 'pending' });
          break;
        default:
          settleBuy({
            kind: 'error',
            message: 'The App Store could not confirm the purchase. You have not been charged twice; try Restore purchases.',
          });
      }
    },
    [settleBuy],
  );

  const iap = useIAP({
    purchaseFlow: purchaseFlow(),
    onPurchaseFlowOutcome,
    onPurchaseError: (error) => {
      settleBuy(
        isUserCancelledError(error)
          ? { kind: 'cancelled' }
          : { kind: 'error', message: getUserFriendlyErrorMessage(error) },
      );
    },
  });
  const { connected, activeSubscriptions, subscriptions, fetchProducts, getActiveSubscriptions, reconnect } = iap;

  // The cached answer first, then the store's.
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((v) => setCachedPlus(v === 'plus'))
      .catch(() => {});
    const timer = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const refreshEntitlement = useCallback(async () => {
    try {
      await getActiveSubscriptions([PLUS_PRODUCT_ID]);
    } catch {
      // Offline or the store is unreachable: the cached answer stands.
    }
  }, [getActiveSubscriptions]);

  const loadProduct = useCallback(async () => {
    try {
      await fetchProducts({ skus: [PLUS_PRODUCT_ID], type: 'subs' });
      setProductAsked(true);
    } catch {
      // The paywall shows a retry.
      setProductFailed(true);
    }
  }, [fetchProducts]);

  const reloadProduct = useCallback(async () => {
    setProductFailed(false);
    setProductAsked(false);
    if (!connected) await reconnect();
    await loadProduct();
  }, [connected, reconnect, loadProduct]);

  const [storeAnswered, setStoreAnswered] = useState(false);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    fetchProducts({ skus: [PLUS_PRODUCT_ID], type: 'subs' })
      .then(() => {
        if (!cancelled) setProductAsked(true);
      })
      .catch(() => {
        if (!cancelled) setProductFailed(true);
      });
    refreshEntitlement().then(() => {
      if (cancelled) return;
      setStoreAnswered(true);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, fetchProducts, refreshEntitlement]);

  // A subscription can lapse or renew while the app sits in the background.
  useEffect(() => {
    if (!connected) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshEntitlement();
    });
    return () => sub.remove();
  }, [connected, refreshEntitlement]);

  const storePlus = hasPlus(activeSubscriptions);
  useEffect(() => {
    if (!storeAnswered) return;
    AsyncStorage.setItem(CACHE_KEY, storePlus ? 'plus' : 'free').catch(() => {});
  }, [storeAnswered, storePlus]);

  const product = subscriptions.find((s) => s.id === PLUS_PRODUCT_ID);
  const groupId = product?.platform === 'ios' ? product.subscriptionGroupIdIOS : null;
  const offersTrial = trialLabel(product) !== null;
  useEffect(() => {
    if (!groupId || !offersTrial) return;
    let cancelled = false;
    isEligibleForIntroOfferIOS(groupId)
      .then((eligible) => {
        if (!cancelled) setTrialGroup(eligible ? groupId : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [groupId, offersTrial]);

  const { requestPurchase, restorePurchases } = iap;

  const buy = useCallback(async (): Promise<PurchaseResult> => {
    if (pendingBuy.current) return { kind: 'pending' };
    const outcome = new Promise<PurchaseResult>((resolve) => {
      pendingBuy.current = resolve;
    });
    try {
      await requestPurchase({ request: { apple: { sku: PLUS_PRODUCT_ID } }, type: 'subs' });
    } catch (error) {
      settleBuy(
        isUserCancelledError(error)
          ? { kind: 'cancelled' }
          : { kind: 'error', message: getUserFriendlyErrorMessage(error as Error) },
      );
    }
    return outcome;
  }, [requestPurchase, settleBuy]);

  const restore = useCallback(async (): Promise<boolean> => {
    await restorePurchases();
    const subs = await readActiveSubscriptions([PLUS_PRODUCT_ID]);
    await refreshEntitlement();
    return hasPlus(subs);
  }, [restorePurchases, refreshEntitlement]);

  const manage = useCallback(() => {
    void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL);
  }, []);

  const value = useMemo<PlanState>(
    () => ({
      ready,
      isPlus: FORCE_PLUS || (storeAnswered ? storePlus : cachedPlus),
      canPurchase: true,
      price: product?.displayPrice ?? null,
      trial: groupId && trialGroup === groupId ? trialLabel(product) : null,
      // Unknown SKUs are left out of the answer without an error, so "loading"
      // ends when the store has answered at all, not when the product shows up.
      loadingProduct: connected && !product && !productFailed && !productAsked,
      buy,
      restore,
      manage,
      reloadProduct: () => void reloadProduct(),
    }),
    [ready, storeAnswered, storePlus, cachedPlus, product, groupId, trialGroup, connected, productFailed, productAsked, buy, restore, manage, reloadProduct],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
