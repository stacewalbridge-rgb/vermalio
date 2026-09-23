# Food2Bude Merchant Setup, Stripe, Menu and Delivery Guide

## 1. What Food2Bude is
Food2Bude is a local ordering and delivery app for Bude-area restaurants, cafés, takeaways, bakeries and pubs.

Customers can:
- browse local food businesses;
- order from one or more outlets in one basket;
- pay in the app;
- track their order;
- receive one coordinated WhyDrive delivery where possible.

Merchants can:
- receive and accept orders;
- set preparation time;
- mark orders ready;
- call a WhyDrive driver;
- manage menus, prices, specials and opening hours;
- use Smart Menu to build a menu from photos or voice;
- receive Stripe payouts;
- reply to customer reviews.

---

## 2. Merchant registration
The merchant opens the Food2Bude Merchant app and selects:

**REGISTER MY BUSINESS**

They enter:
- business name;
- business address;
- owner/contact name;
- phone number;
- email address;
- business type;
- opening hours.

Then they continue to Stripe setup.

---

## 3. Connecting Stripe — merchant instructions
Food2Bude should use Stripe Connect with Stripe-hosted onboarding.

The merchant does not give Food2Bude their online banking password or card details.

Inside Food2Bude Merchant:

1. Tap **Connect Stripe**.
2. Food2Bude opens Stripe's secure onboarding page in the device browser.
3. If the merchant already uses Stripe, sign in and reuse the available business information.
4. If they do not use Stripe, create the Stripe-connected account when prompted.
5. Enter or confirm the business/legal information Stripe requests.
6. Enter the bank account Stripe should use for payouts.
7. Complete any identity or business verification requested by Stripe.
8. Accept Stripe's terms.
9. Stripe returns the merchant to Food2Bude.
10. Food2Bude checks the account status.
11. When Stripe reports that required onboarding is complete and payouts are enabled, show:
   **STRIPE CONNECTED**
12. If Stripe needs more information later, show:
   **ACTION REQUIRED — COMPLETE STRIPE CHECKS**
   and send the merchant back through Stripe-hosted onboarding.

Important:
- Stripe decides which verification details are required based on the business, country and requested payment capabilities.
- A successful return to Food2Bude does not by itself prove onboarding is complete; Food2Bude must check the connected account status.
- Stripe Account Links are temporary and should only be opened from inside the authenticated Food2Bude Merchant app.

---

## 4. How Food2Bude must connect Stripe technically
Food2Bude backend flow:

1. Create a Stripe connected account for the merchant.
2. Store the returned Stripe connected account ID against that merchant record.
3. Create a Stripe Account Link using that connected account ID.
4. Supply:
   - refresh_url
   - return_url
   - type=account_onboarding
5. Return the one-time Account Link URL to the merchant app.
6. Open that URL in the device browser.
7. On return, retrieve the connected Stripe account and check outstanding requirements and enabled capabilities.
8. Listen for Stripe account.updated webhooks and keep Food2Bude's merchant status in sync.
9. Never treat the return_url alone as proof that the merchant is verified.
10. If requirements become due later, create a new onboarding Account Link and ask the merchant to complete the missing information.

For mobile apps, Stripe-hosted onboarding should open in the system browser/custom tab rather than an embedded webview.

---

## 5. Food2Bude payment model
For a simple one-outlet order:
- customer places an order request;
- merchant accepts;
- Food2Bude attempts payment;
- once payment succeeds, the order becomes paid and preparation continues.

For a multi-outlet order:
- Food2Bude creates one customer parent order;
- each outlet receives its own child order;
- all participating outlets must accept before Food2Bude attempts the final payment;
- if any outlet declines, the customer is not charged;
- the customer can amend or cancel the basket;
- after all outlets accept, Food2Bude attempts the customer payment;
- once paid, merchant allocations are routed using Stripe Connect;
- one WhyDrive multi-stop delivery job is created where appropriate.

Stripe supports creating a charge on the platform and transferring funds to multiple connected accounts using separate charges and transfers. The exact production setup, liability model and fee model must be finalised before live launch.

---

## 6. Stripe costs to explain to merchants
Current standard UK Stripe online card pricing shown by Stripe is:
- 1.5% + 20p for standard UK cards;
- 2.8% + 20p for premium UK cards;
- 2.5% + 20p for EEA cards;
- 3.15% + 20p for international cards;
- currency-conversion fees can also apply.

Food2Bude launch target merchant commission:
**around 10% of the food/order value**

This is a target launch model, not a final legal tariff until the commercial terms are issued.

There are two main Stripe Connect pricing approaches:

### Stripe handles pricing for connected merchants
Stripe states that platforms using this model do not incur additional Connect account/payout fees from Stripe; Stripe charges connected users under its payment pricing.

### Food2Bude handles pricing
Stripe currently lists:
- £2 per monthly active connected account;
- 0.25% + 10p per payout sent;
with additional payment-processing charges depending on the transaction.

Food2Bude should choose one model before merchant contracts are issued, because the real margin depends on which Stripe fee model is used.

---

## 7. Adding a menu with Smart Menu
In Food2Bude Merchant:

1. Tap **Smart Menu**.
2. Choose **Scan Menu**.
3. Photograph the first menu page clearly.
4. Photograph any additional pages.
5. Tap **Analyse Menu**.
6. Food2Bude creates a draft containing:
   - sections;
   - item names;
   - descriptions;
   - prices;
   - dietary information that is visibly printed on the source.
7. Review every item.
8. Tap an item to correct the name, description or price.
9. Remove anything that was read incorrectly.
10. Tap **Approve & Publish**.

Nothing is published automatically.

---

## 8. Adding or changing prices
Open:

**Menu → Select item → Edit**

Change:
- item name;
- price;
- description;
- availability;
- category.

Then tap:

**SAVE**

For several changes at once, the merchant can use Smart AI and say something such as:

“Change cod and chips to £13.50 and mushy peas to £1.75.”

Food2Bude creates a draft first. The merchant approves it before it becomes live.

---

## 9. Adding food photos
Food photos are optional.

Food2Bude should not automatically source or generate substitute food images.

If the merchant wants an image:
1. Open the menu item.
2. Tap **Add Photo**.
3. Take a photo or choose one owned by the merchant.
4. Preview it.
5. Tap **Use This Photo**.

---

## 10. Specials
Tap:

**Smart Menu → Today's Specials**

The merchant can:
- photograph a specials board;
- type a special manually;
- speak the new special.

Food2Bude prepares the draft.
The merchant checks it and taps:

**Approve & Publish**

The special can later be paused or removed with one tap.

---

## 11. Sold-out items
Open the item and tap:

**SOLD OUT**

It stops being available for new customer orders.

When available again, tap:

**BACK IN STOCK**

---

## 12. What happens when an order arrives
The merchant receives a clear new-order alert.

The order shows:
- order number;
- items;
- value;
- delivery/collection;
- whether it belongs to a combined multi-outlet order.

The merchant chooses:
- Accept — 15 minutes
- Accept — 25 minutes
- Accept — 40 minutes
- Decline

The chosen preparation time helps Food2Bude and WhyDrive coordinate collection.

---

## 13. Payment before preparation
The merchant screen should always display the payment state.

Possible states:
- Awaiting other merchants
- Awaiting customer payment
- Paid
- Payment failed
- Cancelled

Food2Bude should clearly warn the merchant not to treat an order as confirmed/paid until the payment status is **PAID**.

If the payment fails:
- customer is told immediately;
- merchant is told **PAYMENT FAILED — ORDER NOT CONFIRMED**;
- WhyDrive dispatch is not started;
- the order can be retried or cancelled.

---

## 14. WhyDrive delivery
For a normal order:
1. Merchant accepts and gives a preparation time.
2. Food2Bude plans the pickup.
3. Merchant can tap **Ready Now** if finished early.
4. Merchant can tap **Call Driver Now** when appropriate.
5. WhyDrive receives the collection job.
6. Driver collects and delivers to the customer.

For multi-outlet orders:
1. Each outlet accepts separately.
2. Food2Bude compares the ready times.
3. One WhyDrive driver is offered a combined route.
4. Driver sees all collection stops before accepting.
5. Collection order is based on readiness and routing.
6. Driver collects the different parts.
7. The complete order is delivered to the customer together.

The aim is to prevent one meal sitting in the car while another outlet is still cooking.

---

## 15. How merchants get paid
Customers pay through Food2Bude using Stripe.

Once the payment succeeds:
- Stripe records the transaction;
- the merchant's share is allocated through their connected Stripe account;
- Food2Bude retains the agreed platform commission/fees;
- Stripe pays the merchant's available balance to the bank account they connected during onboarding, according to the payout schedule applying to that connected account.

Food2Bude Merchant should show:
- gross Food2Bude sales;
- Food2Bude commission;
- Stripe/payment fees where applicable;
- refunds;
- net merchant amount;
- payout status.

Merchants should be able to open their Stripe payout/account dashboard from Food2Bude where the selected Connect account type allows it.

---

## 16. Customer app — simple explanation
Food2Bude gives customers one local app for Bude food.

Customer steps:
1. Open Food2Bude.
2. Enter delivery address/postcode.
3. Browse businesses that are open now.
4. See businesses opening later separately.
5. Open a merchant menu.
6. Add food to basket.
7. Add food from another participating outlet if wanted.
8. Submit the order.
9. Outlets accept their parts.
10. Payment is taken only after the order can be fulfilled.
11. Track preparation.
12. Track the WhyDrive driver.
13. Receive the complete delivery.
14. Rate the food/outlet and delivery separately.

---

## 17. Reviews
Food/outlet and delivery ratings are separate.

For a 1-star or 2-star food/outlet rating, the customer must provide a reason.

If the text clearly complains about delivery rather than the food/outlet, Food2Bude should prompt the customer to put that feedback in the separate delivery review instead.

The outlet can publicly reply to merchant reviews.

---

## 18. Simple merchant summary
To start using Food2Bude:

1. Register the business.
2. Connect Stripe.
3. Set opening hours.
4. Photograph the menu.
5. Check the generated menu.
6. Approve it.
7. Set collection/WhyDrive delivery options.
8. Go live.
9. Accept orders and set preparation times.
10. Get paid through Stripe.
