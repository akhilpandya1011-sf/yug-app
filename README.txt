YUG CREATION - LIVE TEST APP (Phase 1)
======================================
A working test version of the trader app. It runs on your Windows laptop and
4-5 phones use it at the same time over your Wi-Fi: trader, office, godown, owner.
Nothing goes to the internet. All data stays in this folder (data.json).

ONE-TIME SETUP (10 minutes)
---------------------------
1. Install Node.js: go to https://nodejs.org, download the LTS version for
   Windows, run the installer and click Next until it finishes.
2. Put this whole folder somewhere easy, for example the Desktop.

EVERY TEST SESSION
------------------
1. Connect the laptop to the Wi-Fi the phones will use.
   (A phone hotspot also works: connect the laptop and the other phones to it.)
2. Double-click  start.bat  in this folder. A black window opens and shows:
       On phones (same Wi-Fi):   http://192.168.x.x:3000
   Keep that window open during the test. Closing it stops the app.
3. If Windows asks "Allow Node.js to communicate on these networks",
   tick Private networks and click Allow access.
4. On each phone, open Chrome and type the address exactly as shown,
   including :3000. Bookmark it or add it to the home screen for quick access.
5. Log in with a different role on each phone (IDs are not case-sensitive,
   passwords are):
       Ambica      Ambica@123    Trader 1  (Ambica Decorators)
       Maha        Maha@123      Trader 2  (Mahalaxmi Tent House)
       Office      Office@123    Office
       GD          GD@123        Godown
       Owner       Owner@123     Owner (Chirag)
   The Owner can change any password from Traders -> New password, and
   Reset (Settings) puts the original passwords back.
6. Keep the office and godown phones on the app screen so they beep when
   an order arrives. Turn the phone volume up.

SUGGESTED TEST SCRIPT (15 minutes)
----------------------------------
 1. Trader phone: search Y03, open it, tap matchings, tap Order, choose 300 m,
    place the order.                          -> Office phone beeps.
 2. Trader phone: try to order 20,000 m of Y03 Firozi. -> App blocks it.
 3. Office phone: open the order, choose the godown, Accept.
                                              -> Godown beeps, trader sees "Accepted".
 4. Trader 2 phone: open Y03 Firozi. The held stock is no longer available.
 5. Godown phone: open the pick list, Mark packed, enter driver, Dispatched.
                                              -> Stock drops on every phone, trader sees "On the way".
 6. Owner phone: Today shows metres dispatched, low stock, phones connected.
 7. Owner phone: Designs -> Add design -> add Y172 with a matching, take a cut
    photo with the camera, save.              -> It appears on the trader phones at once.
 8. Owner phone: open any design -> Stock in / adjust -> add 10 TP.
 9. Owner phone: Traders -> Add a trader -> create a login, log in with it on a phone.
10. Trader phone: tap "Ask rate on WhatsApp" (opens WhatsApp to the office number
    set in Owner -> Settings).
11. Switch a trader phone to Gujarati with the button at the top.
12. Owner -> Settings -> Reset everything to start again.

PUTTING IT ON THE INTERNET (so Chirag in Surat can use it)
---------------------------------------------------------
See DEPLOY.txt in this folder. It takes about 20 minutes on Render.com's free plan.

WHAT IT DOES NOT DO (on purpose)
--------------------------------
- No rates are shown anywhere ("Rate on request"), as Chirag asked.
- No notifications when the app is closed. The phone must have the page open.
- Basic security only: passwords, role checks, login attempt limits. Good
  enough for a pilot with known traders; not for real money or public use.
- This is a pilot rig. The real app will be built on Next.js and Supabase as
  per the roadmap, using what you learn here.

IF A PHONE CANNOT OPEN THE ADDRESS
----------------------------------
- Check the phone and laptop are on the SAME Wi-Fi (not mobile data).
- Windows: Settings -> Network & Internet -> the Wi-Fi you are on ->
  set Network profile to "Private". Then restart start.bat.
- Windows Security -> Firewall & network protection -> Allow an app through
  firewall -> make sure Node.js is ticked for Private.
- Some office/public Wi-Fi blocks phones from seeing laptops. Use a phone
  hotspot instead: hotspot on one phone, laptop and other phones join it.
- The address changes if the laptop joins a different Wi-Fi. Read it again
  from the black window.

FILES
-----
start.bat    double-click to start
server.js    the local server (Node.js, no extra installs)
seed.js      starting stock from the 16 Oct 2026 PDF and the test logins
data.json    live data (created on first run; delete it to start fresh)
public/      the app the phones open, including swatch photos
