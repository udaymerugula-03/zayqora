import { expect, test } from "@playwright/test";

const restaurantPath = "/api/v1/public/restaurants/saffron-table";

test.describe("Public restaurant contract", () => {
  test("serves the published Pakistan demonstration restaurant", async ({ request }) => {
    const listing = await request.get("/api/v1/public/restaurants");
    expect(listing.ok()).toBeTruthy();
    expect(await listing.json()).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ slug: "saffron-table", currency: "PKR" }),
      ]),
    });

    const response = await request.get(restaurantPath);
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      name: "Saffron Table",
      currency: "PKR",
      timezone: "Asia/Karachi",
      published: true,
      allow_pickup: true,
    });
  });

  test("quotes menu selections using server prices", async ({ request }) => {
    const response = await request.get(`${restaurantPath}/menu`);
    expect(response.ok()).toBeTruthy();
    const menu = await response.json();
    const items = menu.categories.flatMap(
      (category: { items: MenuItem[] }) => category.items,
    );
    const item: MenuItem | undefined = items.find(
      (candidate: MenuItem) =>
        candidate.available &&
        (!candidate.variant_required || candidate.variants.length > 0),
    );
    expect(item, "The demonstration menu must include an orderable dish").toBeDefined();
    if (!item) throw new Error("No orderable demonstration menu item");
    const variant = item.variant_required ? item.variants[0] : undefined;
    const quoteResponse = await request.post(`${restaurantPath}/quote`, {
      data: {
        fulfilment: "pickup",
        items: [
          {
            menu_item_id: item.id,
            quantity: 2,
            variant_id: variant?.id ?? null,
            modifier_ids: [],
            notes: "",
          },
        ],
      },
    });
    expect(quoteResponse.ok()).toBeTruthy();
    const quote = await quoteResponse.json();
    expect(quote).toMatchObject({
      currency: "PKR",
      quote_token: expect.any(String),
      items: [
        expect.objectContaining({ menu_item_id: item.id, quantity: 2 }),
      ],
    });
    for (const field of ["subtotal", "delivery_fee", "tax", "total"]) {
      expect(quote[field]).toMatch(/^\d+\.\d{2}$/);
    }
    const unitPrice = Number(item.price) + Number(variant?.price_delta ?? "0");
    expect(quote.items[0].unit_price).toBe(unitPrice.toFixed(2));
    expect(quote.items[0].line_total).toBe((unitPrice * 2).toFixed(2));
    expect(quote.subtotal).toBe((unitPrice * 2).toFixed(2));
    expect(quote.delivery_fee).toBe("0.00");
  });

  test("rejects invalid quantities and unknown tracking tokens", async ({ request }) => {
    const invalidQuote = await request.post(`${restaurantPath}/quote`, {
      data: {
        fulfilment: "pickup",
        items: [
          {
            menu_item_id: "00000000-0000-0000-0000-000000000000",
            quantity: 0,
            variant_id: null,
            modifier_ids: [],
            notes: "",
          },
        ],
      },
    });
    expect(invalidQuote.status()).toBe(422);
    const tracking = await request.get(
      "/api/v1/public/orders/not-a-valid-tracking-token",
    );
    expect(tracking.status()).toBe(404);
  });
});

interface MenuItem {
  id: string;
  price: string;
  available: boolean;
  variant_required: boolean;
  variants: { id: string; price_delta: string }[];
}
