/**
 * app.js - Main POS application coordinator
 */

document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    try {
        await DataStore.init();
    } catch (error) {
        console.error('POS bootstrap failed, continuing with fallback UI init:', error);
    }

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

    const safeUserName = String(session.userName || 'Cashier').trim() || 'Cashier';
    const displayName = isCustomerTerminal ? 'Self Checkout' : safeUserName;
    const displayAvatar = isCustomerTerminal ? 'S' : safeUserName.charAt(0).toUpperCase();
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

    async function submitOrderToBackend(orderData, dataPayload) {
        try {
            const userRole = localStorage.getItem('userRole') || 'cashier';
            let userId = 'USR-002';
            try {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                userId = currentUser && currentUser.id ? currentUser.id : userId;
            } catch (err) {
                userId = 'USR-002';
            }
            const companyId = localStorage.getItem('activeBusinessId') || 'BIZ-101';
            const customerPayload = dataPayload && dataPayload.customer ? dataPayload.customer : {};

            async function resolveCustomerId() {
                const phoneDigits = String(customerPayload.phone || '').replace(/\D/g, '').slice(-10);
                if (phoneDigits.length === 10) {
                    try {
                        const byPhoneRes = await fetch(`http://localhost:3000/api/customers/phone/${encodeURIComponent(phoneDigits)}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-role': userRole
                            }
                        });
                        if (byPhoneRes.ok) {
                            const found = await byPhoneRes.json();
                            if (found && found.id) return found.id;
                        }
                    } catch (err) {}
                }

                try {
                    const createdRes = await fetch('http://localhost:3000/api/customers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-role': userRole
                        },
                        body: JSON.stringify({
                            companyId,
                            name: String(customerPayload.name || 'Walk-in Customer').trim() || 'Walk-in Customer',
                            mobileNo: phoneDigits.length === 10 ? phoneDigits : `9${Date.now().toString().slice(-9)}`,
                            email: String(customerPayload.email || '').trim() || undefined,
                            address: String(customerPayload.address || '').trim() || undefined
                        })
                    });
                    if (createdRes.ok) {
                        const created = await createdRes.json();
                        if (created && created.id) return created.id;
                    }
                } catch (err) {}

                return 'CUS-001';
            }

            const resolvedCustomerId = await resolveCustomerId();

            const backendPayload = {
                customerName: String(customerPayload.name || '').trim() || undefined,
                customerId: resolvedCustomerId,
                staffId: userId,
                companyId: companyId,
                orderType: dataPayload.orderType || 'delivery',
                checkoutMode: dataPayload.checkoutMode || 'prepaid_delivery',
                discountAmount: Math.max(0, Number(dataPayload.discount && dataPayload.discount.discount || 0)),
                promoCode: dataPayload.discount && dataPayload.discount.active ? dataPayload.discount.code : undefined,
                paymentMethod: dataPayload.paymentMethod || 'UPI',
                items: dataPayload.cart.map(item => ({
                    productId: item.id,
                    quantity: Number(item.qty || item.quantity || 1),
                    itemPrice: item.price
                }))
            };

            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': userRole
                },
                body: JSON.stringify(backendPayload)
            });

            if (!response.ok) {
                console.warn('Failed to submit order to backend:', response.status);
                return;
            }

            const backendOrder = await response.json();
            console.log('Order submitted to backend:', backendOrder.id);
        } catch (error) {
            console.error('Error submitting order to backend:', error);
        }
    }

    UI.setCallbacks({
        onCheckout: (dataPayload) => {
            const newOrder = DataStore.createOrder(
                dataPayload.customer,
                dataPayload.cart,
                dataPayload.discount
            );

            console.log('Simulating gateway redirect for order:', newOrder);
            // Submit order to backend API without blocking the UI flow.
            submitOrderToBackend(newOrder, dataPayload);
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
