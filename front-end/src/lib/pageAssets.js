// Stylesheets are imported as plain text (`?inline`) so usePageSetup can mount
// and unmount them per route, the same way each HTML page linked its own CSS.
import dashboardCss from '../styles/dashboard.css?inline';
import cashierCss from '../styles/cashier.css?inline';
import landingCss from '../styles/landing.css?inline';
import registerCss from '../styles/register.css?inline';
import loginCss from '../styles/style.css?inline';

export const CSS = {
  dashboard: dashboardCss,
  cashier: cashierCss,
  landing: landingCss,
  register: registerCss,
  login: loginCss,
};

// The exact Google Fonts URLs each HTML page requested.
export const FONTS = {
  // dashboard, orders, inventory, delivery, returns, reports, users,
  // profile, notifications, superuser, businesses, cashier
  app: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  // choose-plan
  choosePlan: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  // business-welcome
  businessWelcome: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // index (landing)
  landing: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap',
  // login, register-business
  auth: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap',
};

// Public assets (served from front-end/public).
export const LOGO = '/logo.png';
export const LOGO_ALT = '/logo1 copy.png';
