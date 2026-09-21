# BudeToYou reviews and merchant media rules

## Merchant photos
- Do not auto-generate or auto-source food photos.
- Merchants may upload their own food photos if they want them shown.
- Menu items can publish with text only.
- Smart Menu Scanner should extract menu sections, item names, descriptions and prices from a photo, then require merchant approval before publishing.

## Review model
Customer review is split into two independent ratings:

### Food / outlet rating
- 1 to 5 stars.
- 1 or 2 stars requires a written reason before submission.
- Prompts should focus on food quality, accuracy, value, packaging and merchant service.
- Merchant can post a public reply.

### Delivery rating
- 1 to 5 stars.
- Delivery issues are rated separately and do not reduce the food outlet's star score.
- Delivery prompts include driver conduct, handling, timeliness and delivery experience.
- WhyDrive/admin can review delivery feedback separately.

## Smart review routing
- If a low food/outlet review mentions delivery, driver, late arrival, delivery time, transport or similar delivery-only issues, the app should interrupt submission.
- Show: "This sounds like feedback about the delivery rather than the food outlet. Please rate the delivery separately so the restaurant is not penalised for something outside its control."
- Customer can edit the outlet review and continue to a separate delivery rating.
- Do not silently delete genuine merchant-related criticism.
- If feedback contains both merchant and delivery issues, split prompts so each part is rated separately.

## Merchant response
- Merchant app has a Reviews section.
- Merchant can view star score, written feedback and order reference.
- Merchant can reply once publicly, with an option to update the reply.
- Abuse/report workflow should be available for inappropriate or unrelated reviews.
