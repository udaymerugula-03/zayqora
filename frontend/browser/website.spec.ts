import {test,expect} from "@playwright/test";

test.beforeEach(async({request})=>{await request.post("http://127.0.0.1:18117/__test/reset");});

test("owner-focused homepage separates registration from customer browsing",async({page})=>{
  await page.goto("/");
  const hero=page.locator(".editorial-hero");
  await expect(hero.getByRole("link")).toHaveCount(1);
  await expect(hero.getByRole("link",{name:"Create your restaurant website",exact:true})).toHaveAttribute("href","/register");
  await expect(hero.getByRole("link",{name:/Discover|Browse/})).toHaveCount(0);
  await expect(page.locator("footer a[href^='/r/']")).toHaveCount(0);
  await expect(page.locator(".collage-main img")).toHaveAttribute("src","/food/biryani-hero.jpg");
  await hero.getByRole("link").click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading",{level:1,name:"Create your restaurant."})).toBeVisible();
  await page.goto("/");
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Browse restaurants",exact:true}).click();
  await expect(page).toHaveURL(/\/#discover$/);
  await expect(page.locator("#discover")).toBeInViewport();
  await page.locator(".restaurant-card").click();
  await expect(page).toHaveURL(/\/r\/saffron-table$/);
  await expect(page.getByRole("navigation",{name:"Restaurant",exact:true}).getByRole("link",{name:"Order online",exact:true})).toBeVisible();
});

test("public owner and admin screens share product branding and action colours",async({page})=>{
  await page.goto("/login");
  await expect(page.getByRole("heading",{level:1,name:"Sign in to ZAYQORA."})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Owner & admin sign in",exact:true})).toHaveAttribute("href","/login");
  const colours=await page.locator(".site-header .brand").evaluate(brand=>({
    name:getComputedStyle(brand).color,
    symbol:getComputedStyle(brand.querySelector(".brand-symbol")!).color,
    accent:getComputedStyle(document.querySelector(".site-header .button")!).backgroundColor
  }));
  for(const [role,path] of [["test-owner","/app/dashboard"],["test-admin","/platform/overview"]]){
    await page.evaluate(token=>sessionStorage.setItem("zayqora-token",token),role);
    await page.goto(path);
    const brand=page.locator(".workspace-brand .brand");
    await expect(brand).toBeVisible();
    await expect(brand).toContainText("ZAYQORA");
    await expect(brand).toContainText("Good food. Beautifully connected.");
    await expect(brand).toHaveCSS("color",colours.name);
    await expect(brand.locator(".brand-symbol")).toHaveCSS("color",colours.symbol);
    await expect(page.locator(".workspace-sidebar a[aria-current=page]")).toHaveCSS("background-color",colours.accent);
    if(role==="test-admin"){
      await expect(page).toHaveTitle("Platform administration | ZAYQORA");
      await expect(page.getByText("ZAYQORA · Platform administration",{exact:true})).toBeVisible();
      await expect(page.getByText(/VIRELEO manages restaurant access/)).toBeVisible();
    }
  }
});

test("website editor persists settings and the public template uses real tenant content",async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/website");
  await page.getByLabel("Colour palette").selectOption("terracotta");
  await expect(page.getByRole("region",{name:"Website content preview"})).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  await page.getByRole("combobox",{name:"Typography",exact:true}).selectOption("sans");
  await page.getByLabel("About your restaurant").fill("Our owner-written restaurant story, from the saved website configuration.");
  await page.getByLabel("SEO title",{exact:true}).fill("Saffron’s own title");
  await page.getByLabel("SEO description",{exact:true}).fill("A unique owner-written search description.");
  await page.getByRole("checkbox",{name:"Accept online reservations"}).uncheck();
  await page.getByRole("checkbox",{name:/Show gallery page/}).check();
  await page.getByRole("button",{name:"+ Add gallery photo"}).click();
  await page.getByLabel("Image path or HTTPS URL (bundled or uploaded)",{exact:true}).fill("/food/biryani.jpg");
  await page.getByLabel("Photo 1 alternative text").fill("Our gallery photograph");
  await page.getByRole("checkbox",{name:/Show FAQs page/}).check();
  await page.getByRole("button",{name:"+ Add question"}).click();
  await page.getByLabel("Question 1",{exact:true}).fill("Do you offer pickup?");
  await page.getByLabel("Answer 1",{exact:true}).fill("Pickup availability is displayed on the current menu.");
  await page.getByLabel("Your published cancellation policy").fill("Please call us to discuss changes to your request.");
  await page.getByRole("button",{name:"Move About the restaurant up",exact:true}).click();
  await page.getByRole("button",{name:"Save website settings",exact:true}).click();
  await expect(page.getByText("Website settings saved. Your published restaurant now uses these settings.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Colour palette")).toHaveValue("terracotta");
  await expect(page.getByLabel("About your restaurant")).toHaveValue(/Our owner-written/);
  for(const device of ["Mobile","Tablet","Desktop"]){
    await page.getByRole("button",{name:device,exact:true}).click();
    await expect(page.locator(".website-preview")).toHaveAttribute("data-device",device.toLowerCase());
  }
  await page.goto("/r/saffron-table");
  await expect(page.locator(".restaurant-template")).toHaveClass(/theme-terracotta typography-sans/);
  await expect(page.getByText("Our owner-written restaurant story, from the saved website configuration.",{exact:true})).toBeVisible();
  const nav=page.getByRole("navigation",{name:"Restaurant",exact:true});
  await expect(nav.getByRole("link",{name:"Reservations",exact:true})).toHaveCount(0);
  await expect(nav.getByRole("link",{name:"Gallery",exact:true})).toBeVisible();
  await expect(nav.getByRole("link",{name:"FAQs",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Chicken Biryani",exact:true})).toBeVisible();
  const homepageHeadings=await page.locator("main section>h2, main section .section-heading h2").allTextContents();
  expect(homepageHeadings.indexOf("A little taste of togetherness.")).toBeLessThan(homepageHeadings.indexOf("A taste of Saffron Table."));
  await expect(page).toHaveTitle(/Home · Saffron’s own title/);
  await nav.getByRole("link",{name:"Gallery",exact:true}).click();
  await expect(page.getByAltText("Our gallery photograph")).toBeVisible();
  await page.goto("/r/saffron-table/faqs");
  await page.getByText("Do you offer pickup?",{exact:true}).click();
  await expect(page.getByText("Pickup availability is displayed on the current menu.",{exact:true})).toBeVisible();
  await page.goto("/r/saffron-table/policies");
  await expect(page.getByText("Please call us to discuss changes to your request.",{exact:true})).toBeVisible();
  await page.goto("/r/saffron-table/reservations");
  await expect(page.getByRole("heading",{name:"Online reservations are unavailable."})).toBeVisible();
});

test("an unpublished restaurant has an authenticated responsive preview and server-checked publication",async({page,request})=>{
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{published:false}});
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/website");
  await expect(page.getByText("Unpublished draft",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Open saved public site ↗"})).toHaveCount(0);
  await page.getByRole("button",{name:"Mobile",exact:true}).click();
  await expect(page.locator(".website-preview").getByRole("heading",{name:"Saffron Table",exact:true})).toBeVisible();
  await page.goto("/app/setup");
  await expect(page.getByText("0 active dining table(s). Reservations need active table capacity; also review pickup and delivery settings.")).toBeVisible();
  await page.route("**/api/v1/restaurant",async route=>{
    if(route.request().method()==="PATCH")return route.fulfill({status:422,json:{detail:"Add an active table before publishing reservations."}});
    await route.continue();
  });
  await page.getByRole("button",{name:"Publish restaurant",exact:true}).click();
  await expect(page.getByText("Add an active table before publishing reservations.",{exact:true})).toBeVisible();
  await page.unroute("**/api/v1/restaurant");
  await page.getByRole("button",{name:"Publish restaurant",exact:true}).click();
  await expect(page.getByText("Your restaurant is published. Open the public site to review it.",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Open public site ↗"})).toBeVisible();
});

test("contact form saves an enquiry with truthful delivery state and owner can resolve it",async({page})=>{
  await page.goto("/r/saffron-table/contact");
  await page.getByLabel("Your name",{exact:true}).fill("Enquiry Guest");
  await page.getByLabel("Email address",{exact:true}).fill("guest@example.com");
  await page.getByLabel("Subject",{exact:true}).fill("A question about pickup");
  await page.getByLabel("Message",{exact:true}).fill("Please tell me about pickup availability for tomorrow.");
  await page.getByRole("checkbox",{name:/I agree to share these details/}).check();
  await page.getByRole("button",{name:"Send enquiry",exact:true}).click();
  await expect(page.getByText(/Email notifications are not configured/)).toBeVisible();
  await expect(page.getByText("ENQ-TEST-1",{exact:true})).toBeVisible();
  await page.evaluate(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/inquiries");
  await page.getByRole("button",{name:"Read enquiry",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByText("Please tell me about pickup availability for tomorrow.",{exact:true})).toBeVisible();
  await dialog.getByRole("combobox",{name:"Enquiry status",exact:true}).selectOption("resolved");
  await dialog.getByRole("button",{name:"Save enquiry status",exact:true}).click();
  await expect(dialog.getByText("Enquiry status saved.",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Close dialog"}).click();
  await expect(page.getByRole("cell",{name:"resolved",exact:true})).toBeVisible();
});

test("disabled fulfilment cannot add menu items or start checkout",async({page,request})=>{
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{allow_pickup:false,allow_delivery:false}});
  await page.goto("/r/saffron-table/menu");
  await expect(page.getByRole("button",{name:"Customise +"})).toBeDisabled();
  await expect(page.getByText("Online ordering is currently unavailable. You can still browse the published menu.")).toBeVisible();
  await page.goto("/r/saffron-table/checkout");
  await expect(page.getByRole("heading",{name:"Online ordering is unavailable."})).toBeVisible();
});

test("public tenant pages adapt to mobile without document overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const path of ["","/menu","/about","/contact","/policies"]){
    await page.goto(`/r/saffron-table${path}`);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
  }
});

test("published samples are clearly labelled across discovery and customer flows",async({page,request})=>{
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{is_demo:true}});
  await page.goto("/");
  await expect(page.locator(".restaurant-card")).toHaveCount(1);
  await expect(page.locator(".restaurant-card").getByText("Sample restaurant",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Choose city").getByRole("option",{name:"Lahore",exact:true})).toHaveCount(1);
  for(const path of ["","/menu","/cart","/checkout","/reservations","/contact","/about","/policies"]){
    const response=await page.goto(`/r/saffron-table${path}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("note")).toContainText("Sample restaurant.");
    await expect(page.getByRole("note")).toContainText("no real food, delivery or table booking is provided");
  }
  await page.goto("/track/test-private-token");
  await expect(page.getByText(/Sample restaurant\. Explore the website/)).toBeVisible();
  await expect(page.getByText("Demonstration only. No cash payment or restaurant service is required.",{exact:true})).toBeVisible();
  await expect(page.getByText(/Pay in cash on pickup or delivery/)).toHaveCount(0);
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const path of ["/","/r/saffron-table/menu"]){
      await page.goto(path);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} at ${width}px`).toBe(true);
    }
  }
});

test("sample owners can preview publish and unpublish with normal visibility checks",async({page,request})=>{
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{is_demo:true}});
  await page.addInitScript(()=>sessionStorage.setItem("zayqora-token","test-owner"));
  await page.goto("/app/setup");
  await expect(page.getByText("Sample restaurant workspace. Orders, reservations and sales figures here are demonstration data, not real fulfilment or commercial revenue.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Unpublish restaurant",exact:true})).toBeEnabled();
  await expect(page.getByRole("link",{name:"Open public site ↗",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Unpublish restaurant",exact:true}).click();
  await expect(page.getByRole("button",{name:"Publish restaurant",exact:true})).toBeEnabled();
  await expect(page.getByRole("link",{name:"Open public site ↗",exact:true})).toHaveCount(0);
  await page.goto("/app/website");
  await expect(page.getByRole("region",{name:"Website content preview"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Open saved public site ↗",exact:true})).toHaveCount(0);
  await page.goto("/app/settings");
  await expect(page.getByRole("checkbox",{name:"Publish restaurant website",exact:true})).toBeEnabled();
  await expect(page.getByRole("checkbox",{name:"Publish restaurant website",exact:true})).not.toBeChecked();
  await page.goto("/app/setup");
  await page.getByRole("button",{name:"Publish restaurant",exact:true}).click();
  await expect(page.getByRole("link",{name:"Open public site ↗",exact:true})).toBeVisible();
  for(const data of [{published:false},{published:true,status:"suspended"}]){
    await request.post("http://127.0.0.1:18117/__test/restaurant",{data});
    await page.goto("/");
    await expect(page.locator(".restaurant-card")).toHaveCount(0);
    const response=await page.goto("/r/saffron-table");
    expect(response?.status()).toBe(404);
  }
});

test("public search metadata uses configured origin and excludes samples and drafts from sitemap",async({page,request})=>{
  await page.goto("/r/saffron-table/about");
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href","http://127.0.0.1:3117/r/saffron-table/about");
  const publishedSitemap=await request.get("/sitemap.xml");
  expect(await publishedSitemap.text()).toContain("http://127.0.0.1:3117/r/saffron-table/menu");
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{is_demo:true}});
  await page.goto("/r/saffron-table/about");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex, nofollow");
  const privateSitemap=await request.get("/sitemap.xml");
  expect(await privateSitemap.text()).not.toContain("/r/saffron-table");
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{is_demo:false}});
  await request.post("http://127.0.0.1:18117/__test/restaurant",{data:{published:false}});
  const unpublishedSitemap=await request.get("/sitemap.xml");
  expect(await unpublishedSitemap.text()).not.toContain("/r/saffron-table");
  const robots=await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /app/");
  expect(await robots.text()).toContain("Sitemap: http://127.0.0.1:3117/sitemap.xml");
});
