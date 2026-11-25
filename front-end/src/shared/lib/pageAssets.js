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

export const FONTS = {
  app: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  choosePlan:
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  businessWelcome:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // index (landing)
  landing:
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap',
  auth: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap',
};

// Public assets (served from front-end/public).
export const LOGO = '/logo.png';
export const LOGO_ALT = '/logo1 copy.png';
