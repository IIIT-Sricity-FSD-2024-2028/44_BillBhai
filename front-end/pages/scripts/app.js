/**
 * app.js - Main POS application coordinator
 */

document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    await DataStore.init();

    const session = DataStore.getSessionContext();
    const isCustomerTerminal = Boolean(session.isCustomerTerminal);
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');
    const appLabelEl = document.querySelector('.bc-app');
    const bcPageEl = document.getElementById('bcPage');
    const dropdownTitleEl = document.getElementById('terminalDropdownTitle');
    const dropdownSubtitleEl = document.getElementById('terminalDropdownSubtitle');
    const checkoutStepTitleEl = document.getElementById('checkoutStepTitle');
    const checkoutStepSubtitleEl = document.getElementById('checkoutStepSubtitle');
    const customerStepSubmitBtn = document.getElementById('customerStepSubmitBtn');
    const paymentStepTitleEl = document.getElementById('paymentStepTitle');
    const paymentStepSubtitleEl = document.getElementById('paymentStepSubtitle');
    const goFulfillmentBtn = document.getElementById('btnGoFulfillment');
    const checkoutBtn = document.getElementById('btnCheckout');
    const resetBtn = document.getElementById('btnResetFlow');
    const checkoutModeHeadingEl = document.getElementById('checkoutModeHeading');

    const displayName = isCustomerTerminal ? 'Self Checkout' : session.userName;
    const displayAvatar = isCustomerTerminal ? 'S' : session.userName.charAt(0).toUpperCase();
    const pageLabel = isCustomerTerminal ? 'Self Checkout' : 'Active Customer';

    if (userNameEl) userNameEl.textContent = displayName;
    if (userRoleEl) userRoleEl.textContent = session.businessName;
    if (avatarEl) avatarEl.textContent = displayAvatar;
    if (appLabelEl && session.businessName) appLabelEl.textContent = session.businessName;
    if (bcPageEl) bcPageEl.textContent = pageLabel;
    if (dropdownTitleEl) dropdownTitleEl.textContent = displayName;
    if (dropdownSubtitleEl) dropdownSubtitleEl.textContent = isCustomerTerminal
        ? `${session.businessName} self-checkout lane`
        : `${session.roleLabel} terminal`;

    if (checkoutStepTitleEl) checkoutStepTitleEl.textContent = isCustomerTerminal ? 'Start Self Checkout' : 'Start New Order';
    if (checkoutStepSubtitleEl) checkoutStepSubtitleEl.textContent = isCustomerTerminal
        ? 'Add your details once. Saved shoppers auto-fill when you enter your phone number.'
        : 'Capture customer details first. Existing customers auto-fill when you enter their phone number.';
    if (customerStepSubmitBtn) customerStepSubmitBtn.textContent = isCustomerTerminal ? 'Begin Shopping' : 'Begin Scanning / Manual Entry';
    if (paymentStepTitleEl) paymentStepTitleEl.textContent = isCustomerTerminal ? 'Ready for Payment' : 'Routing to Gateway...';
    if (paymentStepSubtitleEl) paymentStepSubtitleEl.textContent = isCustomerTerminal
        ? 'Your order is prepared. Complete payment to confirm the self-checkout.'
        : 'The payload has been sent successfully. The user chooses Card, UPI, etc., on their device/interface. Webhook triggers upon completion.';
    if (goFulfillmentBtn) goFulfillmentBtn.textContent = isCustomerTerminal
        ? 'Continue to Fulfillment'
        : 'Continue to Fulfillment & Payment';
    if (checkoutModeHeadingEl) checkoutModeHeadingEl.textContent = isCustomerTerminal ? 'How would you like to receive this order?' : 'How should this order go out?';
    if (checkoutBtn) checkoutBtn.textContent = isCustomerTerminal ? 'Proceed to Secure Payment' : 'Proceed to Payment Gateway';
    if (resetBtn) resetBtn.textContent = isCustomerTerminal ? 'Start Another Checkout' : 'Next Customer (Reset POS)';
    if (isCustomerTerminal) document.title = 'BillBhai - Self Checkout';

    UI.setSessionContext(session);

    UI.setCallbacks({
        onCheckout: (dataPayload) => {
            const newOrder = DataStore.createOrder(
                dataPayload.customer,
                dataPayload.cart,
                dataPayload.discount
            );

            console.log('Simulating gateway redirect for order:', newOrder);
            return newOrder;
        }
    });

    UI.init();

    document.querySelectorAll('a[href=\"login.html\"]').forEach(link => {
        link.addEventListener('click', () => {
            localStorage.removeItem('userRole');
            localStorage.removeItem('userName');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeBusinessId');
            localStorage.removeItem('activeBusinessName');
            sessionStorage.removeItem('bb_customer_session_id');
            sessionStorage.removeItem('bb_customer_session_notifications');
        });
    });
});
