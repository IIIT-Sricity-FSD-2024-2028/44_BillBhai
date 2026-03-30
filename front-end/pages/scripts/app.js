/**
 * app.js - Main POS application coordinator
 */

document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    await DataStore.init();

    const session = DataStore.getSessionContext();
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');
    const appLabelEl = document.querySelector('.bc-app');

    if (userNameEl) userNameEl.textContent = session.userName;
    if (userRoleEl) userRoleEl.textContent = session.businessName;
    if (avatarEl) avatarEl.textContent = session.userName.charAt(0).toUpperCase();
    if (appLabelEl && session.businessName) appLabelEl.textContent = session.businessName;

    UI.setCallbacks({
        onCheckout: (dataPayload) => {
            const newOrder = DataStore.createOrder(
                dataPayload.customer,
                dataPayload.cart,
                dataPayload.discount
            );

            console.log('Simulating gateway redirect for order:', newOrder);
        }
    });

    UI.init();
});
