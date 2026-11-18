import {test,expect,type Page} from "@playwright/test";
async function addDish(page:Page){
  await page.goto("/r/saffron-table/menu");
  await page.getByRole("button",{name:"Customise +"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("radio",{name:/Regular/}).check();
  await page.getByRole("checkbox",{name:/Raita/}).check();
  await page.getByRole("button",{name:"Add to bag +"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function fillCheckout(page:Page){
  await page.getByLabel("Full name").fill("Test Guest");
  await page.getByLabel("Email address").fill("guest@example.com");
  await page.getByLabel("Phone number").fill("+923001234567");
  await page.getByRole("checkbox",{name:/I agree to the terms/}).check();
  await page.getByRole("checkbox",{name:/I confirm this current total/}).check();
}
test.beforeEach(async({request})=>{await request.post("http://127.0.0.1:18117/__test/reset");});
test("verification recovery submits the account email and reports actual delivery state",async({page})=>{
  await page.route("**/api/v1/auth/resend-verification",async route=>{
    expect(route.request().postDataJSON()).toEqual({email:"owner@example.com"});
    await route.fulfill({json:{message:"If an unverified account exists, a fresh verification link was queued. SMTP is not configured; no email has been sent.",email_delivery_status:"provider_not_configured"}});
  });
  await page.goto("/verify-email");
  await page.getByLabel("Account email for verification").fill("owner@example.com");
  await page.getByRole("button",{name:"Resend verification link"}).click();
  await expect(page.getByText(/Delivery status: provider_not_configured/)).toBeVisible();
  await page.goto("/login");
  await page.getByRole("button",{name:"Need a new verification link?"}).click();
  await expect(page.getByLabel("Account email for verification")).toBeVisible();
});
test("owner kitchen board requests active orders and applies fulfilment filters",async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  const initial=page.waitForRequest(request=>new URL(request.url()).pathname==="/api/v1/orders");
  await page.goto("/app/kitchen");
  expect(new URL((await initial).url()).searchParams.get("active_only")).toBe("true");
  await expect(page.getByRole("heading",{level:1,name:"Kitchen order board"})).toBeVisible();
  const filtered=page.waitForRequest(request=>new URL(request.url()).searchParams.get("fulfilment")==="delivery");
  await page.getByRole("combobox",{name:"Fulfilment",exact:true}).selectOption("delivery");
  await filtered;
  await expect(page.getByRole("combobox",{name:"Status",exact:true}).getByRole("option",{name:"COMPLETED",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Refresh board"})).toBeEnabled();
});
test("homepage displays the new biryani photograph on desktop and mobile",async({page})=>{
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    const photo=page.locator(".editorial-hero .collage-main img");
    await expect(photo).toHaveAttribute("src","/food/biryani-hero.jpg");
    await expect(photo).toHaveAttribute("alt","A platter of fragrant biryani garnished with lime");
    await expect.poll(()=>photo.evaluate(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
test("discovery filters real results and both mobile menus support keyboard dismissal",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  const search=page.getByRole("searchbox",{name:"Search restaurants or cuisine"});
  await search.fill("not-a-published-restaurant");
  await expect(page.getByText("No restaurants match this search. Try another city or craving.")).toBeVisible();
  await search.fill("biryani");
  await expect(page.getByText("0 places to discover",{exact:true})).toBeVisible();
  await search.fill("Saffron");
  await page.getByLabel("Choose city").selectOption("Lahore");
  await expect(page.locator(".restaurant-card")).toHaveCount(1);
  const menu=page.getByRole("button",{name:"Menu",exact:true});
  await menu.click();
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link").first().focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  await page.evaluate(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/dashboard");
  const workspaceMenu=page.getByRole("button",{name:"Workspace menu"});
  await workspaceMenu.click();
  await page.getByRole("navigation",{name:"Workspace",exact:true}).getByRole("link",{name:/Orders/}).focus();
  await page.keyboard.press("Escape");
  await expect(workspaceMenu).toBeFocused();
  await workspaceMenu.click();
  await page.getByRole("navigation",{name:"Workspace",exact:true}).getByRole("link",{name:/Orders/}).click();
  await expect(page).toHaveURL(/\/app\/orders$/);
  await expect(workspaceMenu).toHaveAttribute("aria-expanded","false");
});
test("cash checkout requires current quote reconfirmation after a price change",async({page,request})=>{
  await addDish(page);
  await page.getByRole("link",{name:/View bag/}).click();
  await expect(page.getByText("680.00").first()).toBeVisible();
  await page.getByRole("link",{name:/Continue to checkout/}).click();
  await fillCheckout(page);
  await request.post("http://127.0.0.1:18117/__test/price");
  await page.getByRole("button",{name:"Place cash order →"}).click();
  await expect(page.getByText(/Prices, availability or the quote may have changed/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Place cash order →"})).toBeDisabled();
  await expect(page.getByRole("checkbox",{name:/I confirm this current total/})).not.toBeChecked();
  await page.getByRole("checkbox",{name:/I confirm this current total/}).check();
  await page.getByRole("button",{name:"Place cash order →"}).click();
  await expect(page).toHaveURL(/\/track\/test-private-token$/);
  await expect(page.getByText("unpaid",{exact:true})).toBeVisible();
  await expect(page.getByText(/No online payment has been taken/)).toBeVisible();
});
test("sample checkout retains its demonstration label through order tracking",async({page,request})=>{
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{is_demo:true}});
  await addDish(page);
  await page.goto("/r/saffron-table/checkout");
  await expect(page.getByRole("note")).toContainText("Sample restaurant.");
  await expect(page.getByText("Demonstration restaurant. This order will not result in real food delivery. Do not use sensitive personal details.",{exact:true})).toBeVisible();
  await fillCheckout(page);
  await page.getByRole("button",{name:"Place cash order →"}).click();
  await expect(page).toHaveURL(/\/track\/test-private-token$/);
  await expect(page.getByText(/Sample restaurant\. Explore the website/)).toBeVisible();
  await expect(page.getByText("Demonstration only. No cash payment or restaurant service is required.",{exact:true})).toBeVisible();
  await expect(page.getByText(/Pay in cash on pickup or delivery/)).toHaveCount(0);
});
test("unknown network result retries identical body and key across reload",async({page})=>{
  await addDish(page);await page.goto("/r/saffron-table/checkout");await fillCheckout(page);
  const requests:{key:string|null;body:string|null}[]=[];
  await page.route("**/api/v1/public/restaurants/saffron-table/orders",async route=>{
    requests.push({key:await route.request().headerValue("idempotency-key"),body:route.request().postData()});
    if(requests.length===1){await route.fetch();await route.abort("connectionreset");}else await route.continue();
  });
  await page.getByRole("button",{name:"Place cash order →"}).click();
  await expect(page.getByRole("button",{name:"Retry original order"})).toBeEnabled();
  await page.reload();
  await page.getByRole("button",{name:"Retry original order"}).click();
  await expect(page).toHaveURL(/\/track\/test-private-token$/);
  expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
  expect(requests[0].key).toBeTruthy();expect(JSON.parse(requests[0].body!)).not.toHaveProperty("payment_status");
});
test("throttled recovery preserves the original committed order attempt",async({page})=>{
  await addDish(page);await page.goto("/r/saffron-table/checkout");await fillCheckout(page);
  const requests:{key:string|null;body:string|null}[]=[];
  await page.route("**/api/v1/public/restaurants/saffron-table/orders",async route=>{
    requests.push({key:await route.request().headerValue("idempotency-key"),body:route.request().postData()});
    if(requests.length===1){await route.fetch();await route.abort("connectionreset");}
    else if(requests.length===2)await route.fulfill({status:429,json:{detail:"Too many checkout attempts."}});
    else await route.continue();
  });
  await page.getByRole("button",{name:"Place cash order →"}).click();
  await page.getByRole("button",{name:"Retry original order"}).click();
  await expect(page.getByRole("alert").filter({hasText:"Too many checkout attempts."})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Retry original order"}).click();
  await expect(page).toHaveURL(/\/track\/test-private-token$/);
  expect(requests).toHaveLength(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2]).toEqual(requests[0]);
});
test("workspace gates roles, loads real endpoint states, and signs out",async({page})=>{
  await page.goto("/app/dashboard");await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("owner@example.com");await page.getByLabel("Password",{exact:true}).fill(crypto.randomUUID());
  await page.getByRole("button",{name:"Sign in →"}).click();await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("heading",{name:"Hello, Demo."})).toBeVisible();
  for(const [path,heading] of [["orders","Every order. A little more organised."],["menu","Fresh ideas. Beautifully served."],["reservations","Every table has a story."],["reports","Your sales, in perspective."],["settings","Your restaurant. Your way."],["notifications","Your notification outbox."]]){
    await page.goto(`/app/${path}`);await expect(page.getByRole("heading",{name:heading,exact:true})).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  }
  await page.goto("/platform/overview");await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.getByRole("button",{name:"Sign out"}).click();await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(()=>sessionStorage.getItem("zayqora-token"))).toBeNull();
});
test("editing menu prices preserves existing variant and modifier IDs",async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/menu");
  await page.getByRole("button",{name:"Edit",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Base price · PKR").fill("625.50");
  const blobUrl="https://test-store.public.blob.vercel-storage.com/restaurant/item.jpg";
  await page.getByLabel("Image path or HTTPS URL (bundled or uploaded)").fill(blobUrl);
  let payload:Record<string,unknown>|null=null;
  await page.route("**/api/v1/menu/items/test-item",async route=>{
    payload=route.request().postDataJSON();
    await route.fulfill({json:{id:"test-item",...payload}});
  });
  await page.getByRole("button",{name:"Save menu item"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(payload).toMatchObject({image_url:blobUrl,price:"625.50",variant_required:true,variants:[{id:"regular",name:"Regular",price_delta:"0.00"},{id:"large",name:"Large",price_delta:"200.00"}],modifiers:[{id:"raita",name:"Raita",price_delta:"80.00"}]});
});
test("reservation decline and cancellation require a three-character reason",async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  const reservation={id:"test-reservation",reference:"RSV-TEST",status:"REQUESTED",starts_at:"2027-01-01T14:00:00+05:00",ends_at:"2027-01-01T15:30:00+05:00",party_size:2,customer_name:"Test Guest",email:"guest@example.com",phone:"+923001234567",notes:"",table_id:"test-table"};
  await page.route("**/api/v1/reservations?**",route=>route.fulfill({json:{items:[reservation],total:1,page:1,page_size:20}}));
  await page.goto("/app/reservations");
  await page.getByRole("button",{name:"Review",exact:true}).click();
  for(const status of ["DECLINED","CANCELLED"]){
    await page.getByLabel("Next status").selectOption(status);
    const reason=page.getByLabel("Reason (required, at least 3 characters)");
    await expect(reason).toHaveAttribute("minlength","3");
    await reason.fill("ab");
    expect(await reason.evaluate((input:HTMLTextAreaElement)=>input.checkValidity())).toBeFalsy();
  }
  await page.getByLabel("Reason (required, at least 3 characters)").fill("  Table unavailable  ");
  let payload:unknown;
  await page.route("**/api/v1/reservations/test-reservation/status",async route=>{
    payload=route.request().postDataJSON();await route.fulfill({json:{...reservation,status:"CANCELLED"}});
  });
  await page.getByRole("button",{name:"Save reservation status"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(payload).toEqual({status:"CANCELLED",reason:"Table unavailable"});
});
test("registration and token verification report actual email delivery state",async({page})=>{
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Demo Owner");
  await page.getByLabel("Restaurant name",{exact:true}).fill("Demo Kitchen");
  await page.getByLabel("Restaurant URL name").fill("demo-kitchen");
  await page.getByLabel("Email address").fill("new@example.com");
  await page.getByLabel(/Password/).fill(crypto.randomUUID());
  await page.getByRole("button",{name:"Create restaurant account"}).click();
  await expect(page.getByText(/Email delivery: provider_not_configured/)).toBeVisible();
  await page.goto("/verify-email?token=test-verification-token");
  await expect(page.getByText("Email verified. You can now sign in.")).toBeVisible();
});
test("service failures surface retry states and unpublished restaurant paths are unavailable",async({page})=>{
  await page.route("**/api/v1/public/restaurants",route=>route.fulfill({status:503,json:{detail:"Restaurant service unavailable."}}));
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText("Restaurant service unavailable.");
  await expect(page.getByRole("button",{name:"Retry discovery"})).toBeVisible();
  await page.goto("/r/not-published");
  await expect(page.getByRole("heading",{name:"Page not available"})).toBeVisible();
  await expect(page.getByRole("link",{name:"ZAYQORA home"}).first()).toBeVisible();
});
test("forms enforce the same cart, reservation and restaurant bounds as the API",async({page})=>{
  await addDish(page);
  await page.goto("/r/saffron-table/cart");
  await expect(page.getByRole("spinbutton",{name:"Quantity for Chicken Biryani"})).toHaveAttribute("max","50");
  await page.goto("/r/saffron-table/reservations");
  await expect(page.getByLabel("Number of guests")).toHaveAttribute("max","30");
  await page.evaluate(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/settings");
  await expect(page.getByLabel("Cuisine",{exact:true})).toHaveAttribute("maxlength","100");
  await expect(page.getByLabel("City",{exact:true})).toHaveAttribute("maxlength","100");
  await expect(page.getByLabel("Dining duration · minutes")).toHaveAttribute("min","15");
  await expect(page.getByLabel("Dining duration · minutes")).toHaveAttribute("max","360");
  await expect(page.getByLabel("Buffer between tables · minutes")).toHaveAttribute("max","180");
  await expect(page.getByLabel("Booking window · days ahead")).toHaveAttribute("max","180");
  await page.getByLabel("Dining duration · minutes").fill("361");
  expect(await page.getByLabel("Dining duration · minutes").evaluate((input:HTMLInputElement)=>input.checkValidity())).toBeFalsy();
  await page.goto("/app/reservations");
  await page.getByRole("button",{name:"Dining tables",exact:true}).click();
  await page.getByRole("button",{name:"+ Add dining table"}).click();
  await expect(page.getByLabel("Seats",{exact:true})).toHaveAttribute("max","30");
});
for(const width of [320,390,768,1440]){
  test(`shared branding and zero document overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for(const path of ["/","/pricing","/login","/register","/verify-email","/privacy","/terms","/r/saffron-table","/r/saffron-table/menu","/r/saffron-table/cart","/r/saffron-table/checkout","/r/saffron-table/reservations","/r/saffron-table/about","/r/saffron-table/contact","/track/test-private-token"]){
      await page.goto(path);
      await expect(page.getByRole("link",{name:"ZAYQORA home"}).first()).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBeTruthy();
      if([390,1440].includes(width)&&["/login","/r/saffron-table","/r/saffron-table/menu","/r/saffron-table/reservations","/track/test-private-token"].includes(path))await page.screenshot({path:`test-results/redesign-${path.replaceAll("/","-")}-${width}.png`,fullPage:true});
    }
    await page.goto("/");
    await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
    await page.addInitScript(()=>sessionStorage.setItem("zayqora-token",sessionStorage.getItem("test-role")||"test-owner"));
    for(const path of ["/app/dashboard","/app/menu","/app/orders","/app/reservations","/app/settings"]){
      await page.goto(path);
      await expect(page.locator("main h1")).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBeTruthy();
      if([390,1440].includes(width)&&["/app/dashboard","/app/settings"].includes(path))await page.screenshot({path:`test-results/redesign-${path.replaceAll("/","-")}-${width}.png`,fullPage:true});
    }
    await page.evaluate(()=>sessionStorage.setItem("test-role","test-admin"));
    for(const path of ["/platform/overview","/platform/tenants","/platform/plans"]){
      await page.goto(path);
      await expect(page.locator("main h1")).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBeTruthy();
      if([390,1440].includes(width)&&path==="/platform/overview")await page.screenshot({path:`test-results/redesign-platform-${width}.png`,fullPage:true});
    }
  });
}
