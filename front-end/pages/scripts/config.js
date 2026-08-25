/**
 * BillBhai — Frontend Configuration
 *
 * This is the single place the frontend decides which backend it talks to.
 * Every script (api-client.js, dashboard.js, app.js, data.js, register.js,
 * script.js) reads its API base URL from here, so the address is written
 * once instead of being repeated in twenty places.
 *
 * Must be loaded BEFORE any other script on the page.
 */
(function () {
  'use strict';

  // =====================================================================
  //  WHICH BACKEND DOES THIS BRANCH TALK TO?      'nest'  |  'express'
  //
  //      branch  main      ->  'nest'     NestJS  backend, port 3000
  //      branch  express   ->  'express'  Express backend, port 4000
  //
  //  Both branches contain both backends. Changing this ONE line is the
  //  only difference between them.
  // =====================================================================
  var BACKEND = 'nest';

  var BACKENDS = {
    nest: {
      label: 'NestJS',
      apiBase: 'http://localhost:3000/api',
      fallbacks: ['http://127.0.0.1:3000/api'],
    },
    express: {
      label: 'Express.js',
      apiBase: 'http://localhost:4000/api',
      fallbacks: ['http://127.0.0.1:4000/api'],
    },
  };

  var active = BACKENDS[BACKEND] || BACKENDS.nest;

  window.BILLBHAI_CONFIG = {
    backend: BACKEND,
    backendLabel: active.label,
    API_BASE_URL: active.apiBase,
    API_BASE_CANDIDATES: active.fallbacks.slice(),
  };

  // Makes it obvious in the browser console which stack is being demoed.
  console.info('[BillBhai] Backend: ' + active.label + ' -> ' + active.apiBase);
})();
