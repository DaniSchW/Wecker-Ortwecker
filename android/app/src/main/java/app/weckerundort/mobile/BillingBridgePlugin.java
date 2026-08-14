package app.weckerundort.mobile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;

/**
 * Bindet Google Play Billing für das werbefreie Jahres-Abo ("Pro-Version")
 * DIREKT ein - ohne Drittanbieter-SDK und ohne eigenes Backend. Kauf,
 * Zahlungsabwicklung, Verlängerung und Kündigung laufen vollständig über den
 * Play Store selbst (siehe openManageSubscription()); diese Klasse fragt
 * lediglich beim Play-Store-eigenen BillingClient den aktuellen Abo-Status ab
 * (queryPurchasesAsync) - das funktioniert auch nach einer Neuinstallation,
 * da der Status am Google-Konto hängt, nicht an lokalem App-Speicher. Eine
 * serverseitige Kauf-Validierung findet bewusst nicht statt: Bei 1 €/Jahr für
 * ein reines "werbefrei"-Feature steht der Aufwand für ein eigenes Backend
 * in keinem Verhältnis zum Betrugsrisiko.
 */
@CapacitorPlugin(name = "BillingBridge")
public class BillingBridgePlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "WeckerOrtswecker";

    // Muss exakt der in der Play Console angelegten Abo-Produkt-ID
    // entsprechen (siehe README, Abschnitt "Pro-Version in der Play Console
    // einrichten").
    static final String PRODUCT_ID_PRO = "pro_jahr";

    private BillingClient billingClient;
    private volatile boolean proActive = false;

    @Override
    public void load() {
        super.load();
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        connect();
    }

    private void connect() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    refreshPurchases();
                } else {
                    Log.e(TAG, "BillingBridge: Setup fehlgeschlagen: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() kuemmert sich selbst um
                // Wiederverbindungsversuche.
            }
        });
    }

    private void refreshPurchases() {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        billingClient.queryPurchasesAsync(params, new PurchasesResponseListener() {
            @Override
            public void onQueryPurchasesResponse(BillingResult billingResult, List<Purchase> purchases) {
                handlePurchases(purchases);
            }
        });
    }

    private void handlePurchases(List<Purchase> purchases) {
        boolean active = false;
        if (purchases != null) {
            for (Purchase purchase : purchases) {
                if (!purchase.getProducts().contains(PRODUCT_ID_PRO)) continue;
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    active = true;
                    if (!purchase.isAcknowledged()) {
                        acknowledge(purchase);
                    }
                }
            }
        }
        proActive = active;
        notifyStatus();
    }

    // Play Billing storniert einen Kauf automatisch, wenn er nicht
    // innerhalb von 3 Tagen bestaetigt wird - ohne diesen Schritt wuerde ein
    // erfolgreicher Kauf dem Nutzer nach kurzer Zeit wieder rueckerstattet.
    private void acknowledge(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, billingResult -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "BillingBridge: acknowledgePurchase fehlgeschlagen: " + billingResult.getDebugMessage());
            }
        });
    }

    private void notifyStatus() {
        JSObject data = new JSObject();
        data.put("active", proActive);
        notifyListeners("proStatusChanged", data);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject data = new JSObject();
        data.put("active", proActive);
        call.resolve(data);
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Keine Activity verfügbar");
            return;
        }

        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT_ID_PRO)
            .setProductType(BillingClient.ProductType.SUBS)
            .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();

        billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(BillingResult billingResult, QueryProductDetailsResult result) {
                List<ProductDetails> list = result.getProductDetailsList();
                if (list == null || list.isEmpty()) {
                    call.reject("Pro-Abo-Produkt nicht gefunden (Play Console prüfen)");
                    return;
                }
                ProductDetails productDetails = list.get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = productDetails.getSubscriptionOfferDetails();
                if (offers == null || offers.isEmpty()) {
                    call.reject("Kein Abo-Angebot verfügbar");
                    return;
                }
                String offerToken = offers.get(0).getOfferToken();

                BillingFlowParams.ProductDetailsParams productDetailsParams =
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .setOfferToken(offerToken)
                        .build();
                BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(productDetailsParams))
                    .build();

                BillingResult launchResult = billingClient.launchBillingFlow(activity, billingFlowParams);
                if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Kauf konnte nicht gestartet werden: " + launchResult.getDebugMessage());
                    return;
                }
                // Das eigentliche Kaufergebnis kommt asynchron über
                // onPurchasesUpdated() (unten) und wird per
                // "proStatusChanged"-Event an JS gemeldet - dieser Aufruf
                // meldet nur, dass der Kauf-Dialog erfolgreich geöffnet wurde.
                call.resolve();
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            handlePurchases(purchases);
        } else if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) {
            Log.e(TAG, "BillingBridge: onPurchasesUpdated Fehler: " + billingResult.getDebugMessage());
        }
    }

    // Öffnet die Play-Store-eigene Abo-Verwaltung (kündigen/pausieren,
    // Zahlungsmethode ändern) - bewusst KEINE eigene UI dafür, das
    // übernimmt Google vollständig.
    @PluginMethod
    public void openManageSubscription(PluginCall call) {
        String packageName = getContext().getPackageName();
        Uri uri = Uri.parse("https://play.google.com/store/account/subscriptions?sku=" + PRODUCT_ID_PRO + "&package=" + packageName);
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Play Store konnte nicht geöffnet werden", e);
        }
    }
}
