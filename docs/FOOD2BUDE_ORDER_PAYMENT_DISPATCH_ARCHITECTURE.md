# Food2Bude combined ordering, payments and Smart Merchant architecture

## Core customer rule: one Food2Bude order, multiple outlets
A customer can add items from more than one participating outlet to one basket.

Example:
- The Mermaid — cod & chips
- Crooklets Beach Cafe — dirty fries
- One delivery address

Food2Bude creates one parent customer order with a separate child order for each outlet.

## Acceptance
Each outlet only sees and accepts its own child order.

The parent order does not progress to payment until every participating outlet has accepted.

If any outlet declines:
- do not charge the customer;
- show which outlet declined;
- let the customer remove that part, substitute an item/outlet, or cancel the whole order;
- recalculate the total and delivery plan before asking for confirmation again.

## Payment rule
At checkout, collect the customer's payment method securely but do not capture a food payment before all outlets accept.

After every outlet accepts:
1. Reconfirm the final basket total.
2. Attempt the customer payment.
3. If payment succeeds, mark all child orders PAID and confirm preparation.
4. If payment fails or requires further authentication, tell the customer immediately and mark merchant orders PAYMENT PENDING / NOT PAID.
5. Merchants must not prepare an unpaid order unless they deliberately override that rule.
6. If payment ultimately fails, cancel the parent order and notify every outlet.

For Stripe Connect, use a platform payment design that supports one customer charge with separate merchant allocations/transfers. Exact Connect implementation must be finalised against the current Stripe API before production.

## Combined WhyDrive delivery
A multi-outlet basket creates one WhyDrive delivery job, not multiple independent deliveries.

The dispatch object contains:
- one customer destination;
- all merchant collection stops;
- each merchant's estimated ready time;
- collection sequence;
- total driver payout;
- order handling notes.

The same driver collects every accepted part of the order and then delivers the complete order to the customer.

## Synchronising preparation
Food2Bude calculates a target collection window so food from the first outlet is not sitting in the vehicle while another outlet is still cooking.

Each merchant provides an expected ready time when accepting.

Dispatch should:
- compare all ready times;
- delay driver dispatch until the route can be collected efficiently;
- choose collection order using readiness + road route, not just merchant order time;
- update the driver when a merchant taps READY NOW;
- allow CALL DRIVER NOW only when it will not cause another part of the combined order to be excessively delayed.

## Smart Merchant
Merchant Smart AI supports:
- photograph printed menu;
- photograph specials board;
- upload an existing menu image;
- voice instruction such as “add cod and chips at £12.95”;
- manual add/edit;
- merchant's own food photographs.

AI creates drafts only.

Nothing publishes until the merchant reviews and approves:
- section;
- item name;
- description;
- price;
- dietary/allergen text copied from the source;
- availability;
- merchant-uploaded image if supplied.

Do not generate or source substitute food photographs automatically.

## State model
Parent order:
DRAFT -> REQUESTED -> MERCHANTS_ACCEPTED -> PAYMENT_PENDING -> PAID -> PREPARING -> COLLECTION_ROUTE_ACTIVE -> OUT_FOR_DELIVERY -> DELIVERED

Child merchant order:
REQUESTED -> ACCEPTED or DECLINED -> PAYMENT_PENDING -> PAID -> PREPARING -> READY -> COLLECTED

If one child declines before payment, parent returns to CUSTOMER_ACTION_REQUIRED.

## Non-negotiables
- No food charge before all merchants accept.
- No driver dispatched as separate jobs for parts of the same combined basket.
- No AI-published menu changes without merchant approval.
- Payment failure is clearly shown to both customer and relevant merchants.
- Driver sees all collection stops before accepting the combined delivery.
