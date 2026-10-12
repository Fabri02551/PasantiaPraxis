import { firefox } from 'playwright-core';
import { fileURLToPath } from 'url';
(async () => {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@praxis.com');
  await page.fill('#password', 'admin123');
  await page.click('button:has-text("Iniciar Sesión")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/after_login.png' });
  console.log('after login url', page.url());
  const content = await page.content();
  console.log('content after login snippet', content.slice(0, 2000));
  const medicosBtn = page.locator('button:has-text("Médicos")').first();
  const visible = await medicosBtn.isVisible().catch(()=>false);
  console.log('medicos btn visible', visible);
  if (visible) {
    await medicosBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/after_medicos.png' });
    const nuevoBtn = page.locator('button:has-text("Nuevo Médico")').first();
    const visible2 = await nuevoBtn.isVisible().catch(()=>false);
    console.log('nuevo btn visible', visible2);
    if (visible2) {
      await nuevoBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/after_click.png' });
      const overlay = page.locator('.vt-overlay');
      const vis3 = await overlay.isVisible().catch(()=>false);
      console.log('overlay visible', vis3);
      if (vis3) {
        const html = await overlay.innerHTML();
        console.log('overlay html', html.slice(0, 1000));
      } else {
        console.log('no overlay');
        const body = await page.content();
        console.log(body.slice(0, 3000));
      }
    }
  }
  await browser.close();
})();
