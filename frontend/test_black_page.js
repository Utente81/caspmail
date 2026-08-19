const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    args: [
      '--no-sandbox', 
      '--disable-web-security', 
      '--ignore-certificate-errors',
      '--host-resolver-rules=MAP caspmail.com 192.168.189.200'
    ],
    headless: 'new'
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  page.on('requestfailed', request => {
    console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  try {
    await page.goto('https://caspmail.com/console/', { waitUntil: 'networkidle2' });
    const content = await page.content();
    console.log('HTML CONTENT:', content.substring(0, 500));
    await page.screenshot({ path: 'black_page.png' });
    console.log('Screenshot saved to black_page.png');
  } catch(e) {
    console.error('Navigation error:', e);
  }

  await browser.close();
})();
